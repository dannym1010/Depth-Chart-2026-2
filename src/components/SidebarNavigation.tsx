import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  Zap,
  Target,
  Swords,
  BookOpen,
  Dumbbell,
  ClipboardList,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  FolderPlus,
  Layers,
  SlidersHorizontal,
  PenTool,
  Folder,
  FolderOpen,
  Search,
  Star,
  Play,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Award,
  Sparkles,
  Flame,
  ArrowRight,
  Filter,
  Camera,
  Home as HomeIcon,
  Activity,
} from 'lucide-react';
import { CustomTabGroup, UnitType, DepthSubUnit, UserRole, Team } from '../types';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import { TabGroupManagerModal } from './TabGroupManagerModal';
import { CustomLogoModal, TeamLogoConfig, DEFAULT_TEAM_LOGO } from './CustomLogoModal';
import {
  DEFENSIVE_DRILLS,
  DEFENSIVE_POSITION_GROUPS,
  DefensivePositionCategory,
  WhiteboardDrill,
  loadEffectiveWhiteboardDrills,
} from './whiteboard/whiteboardDrillData';

export interface SidebarNavigationProps {
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
  activeWhiteboardDrillId?: string;
  activeWhiteboardCategory?: DefensivePositionCategory | 'ALL';
  onSelectWhiteboardDrill?: (drillId: string, category: DefensivePositionCategory) => void;
  onSelectWhiteboardCategory?: (category: DefensivePositionCategory) => void;
  activeTeam?: Team;
  guideTree?: Record<string, Record<string, string>>;
  onSelectGuideMain?: (main: string) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export interface NavItemConfig {
  id: UnitType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
  description: string;
  adminOnly?: boolean;
  hasCascadingFolders?: boolean;
}

const MAIN_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'home',
    label: 'Home & Upcoming Events',
    shortLabel: 'Home',
    icon: HomeIcon,
    description: 'Main splash dashboard showing upcoming practice info and links, and upcoming game info and links',
    badgeText: 'Dashboard',
  },
  {
    id: 'depth_chart',
    label: 'Depth Chart & Formations',
    shortLabel: 'Depth Chart',
    icon: Layers,
    description: 'Offensive formations, defensive fronts, special teams, position groups & 11v11 scrimmage rotation',
    badgeText: 'Formations',
    hasCascadingFolders: true,
  },
  {
    id: 'whiteboard',
    label: 'Drills & Whiteboard Playbook',
    shortLabel: 'Drills',
    icon: Folder,
    description: 'Krausko linebacker blitz progression, NT 2-gap combat, tackling circuits & playbook whiteboard',
    badgeText: '15 Drills',
    hasCascadingFolders: true,
  },
  {
    id: 'game_day',
    label: 'Game Day Hub',
    shortLabel: 'Game Day',
    icon: Swords,
    description: 'Sideline call sheet, player wristband inserts, opponent scouting & game clock',
    badgeText: 'Live Hub',
    hasCascadingFolders: true,
  },
  {
    id: 'hudl_scout',
    label: 'Hudl Scout',
    shortLabel: 'Hudl Scout',
    icon: Target,
    description: 'Our-team film by game plus this week’s opponent Hudl CSV/Excel tendencies',
    badgeText: 'Film',
  },
  {
    id: 'practice',
    label: 'Practice Planner',
    shortLabel: 'Practice',
    icon: ClipboardList,
    description: 'Practice periods, drill stations, coach assignments & minute-by-minute scripts',
    badgeText: 'Schedule',
  },
  {
    id: 'guide',
    label: 'Playbooks & Guides',
    shortLabel: 'Playbooks',
    icon: BookOpen,
    description: 'Offensive, defensive, and special teams PDF playbooks & printable play sheets',
    badgeText: 'Guides',
    hasCascadingFolders: true,
  },
  {
    id: 'compliance',
    label: 'Compliance & Hours',
    shortLabel: 'Hours',
    icon: Zap,
    description: 'Weekly practice hours tracker, heat acclimatization, contact limits & safety logs',
    badgeText: 'Safety',
  },
  {
    id: 'ppr',
    label: 'PFF Film Grades',
    shortLabel: 'PFF',
    icon: Activity,
    description: 'Hudl play export grades, Black/Gold/Blue units including special teams, and Monday film by player',
    badgeText: 'Film',
  },
  {
    id: 'schedule',
    label: 'Team Schedule',
    shortLabel: 'Schedule',
    icon: Calendar,
    description: 'Game dates, practices, weigh-ins, film sessions & team calendar events',
  },
  {
    id: 'mobile_hub',
    label: 'Mobile Coach HUD',
    shortLabel: 'Mobile',
    icon: Smartphone,
    description: 'Optimized touch interface for sideline drills, quick depth checks & attendance',
  },
  {
    id: 'users',
    label: 'Staff & Team Access',
    shortLabel: 'Staff',
    icon: Users,
    description: 'Manage assistant coaches, coordinator permissions, parent access & rosters',
    adminOnly: true,
  },
];

const POSITION_CATEGORY_INFO: Record<
  DefensivePositionCategory,
  { name: string; shortLabel: string; icon: string; badgeColor: string; description: string }
> = {
  OFFENSE: {
    name: 'Offense (27 Drills)',
    shortLabel: 'Offense',
    icon: '🏈',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: 'Quarterback drops, running back mesh, offensive line power steps, receiver routes & team install',
  },
  OFF_QB: {
    name: 'Quarterbacks (QB)',
    shortLabel: 'QB',
    icon: '🎯',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: '3-Step drop, play-action bootleg, shotgun quick game & target net drills',
  },
  OFF_RB: {
    name: 'Running Backs (RB)',
    shortLabel: 'RB',
    icon: '💨',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: 'Handoff mesh, downhill A/B-gap press, gauntlet ball security & perimeter stretch',
  },
  OFF_OL: {
    name: 'Offensive Line (OL)',
    shortLabel: 'OL',
    icon: '🧱',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: '6-inch power step, drive block board fit, chute fire-out & pulling guard traps',
  },
  OFF_WR: {
    name: 'Wide Receivers & TEs',
    shortLabel: 'WR / TE',
    icon: '⚡',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: 'Stance release, route tree landmarks, stalk perimeter blocking & diamond hands',
  },
  OFF_TEAM: {
    name: 'Team Offense & Install',
    shortLabel: 'Off Team',
    icon: '👥',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    description: 'Stance & alignment, QB-Center exchange, script walkthrough & 11-on-11 team session',
  },
  DEFENSE: {
    name: 'Defense (All Positions)',
    shortLabel: 'Defense',
    icon: '🛡️',
    badgeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    description: 'Defensive tackles, edge containment, linebacker flow, secondary pursuit & team schemes',
  },
  DL: {
    name: 'Defensive Tackles (DL)',
    shortLabel: 'DL / DT',
    icon: '🧱',
    badgeColor: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
    description: 'A/B-Gap Fits, Ball Get-Off, NT 2-Gap Bullet',
  },
  DE: {
    name: 'Defensive Ends (DE)',
    shortLabel: 'DE / Edge',
    icon: '⚡',
    badgeColor: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30',
    description: 'Containment Stiff-Arm, Hoop Bend & Edge Crash',
  },
  LB: {
    name: 'Linebackers (LB)',
    shortLabel: 'Linebackers',
    icon: '💥',
    badgeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    description: 'Krausko Blitz Progression, Freeze Step & Scrape',
  },
  DB: {
    name: 'Defensive Backs (DB)',
    shortLabel: 'Secondary',
    icon: '🦅',
    badgeColor: 'bg-purple-600/20 text-purple-300 border-purple-500/30',
    description: 'Alley Trigger, Centerfield Post Break, Tip Turnovers',
  },
  TEAM: {
    name: 'Team Tackling & Circuits',
    shortLabel: 'Team Defense',
    icon: '🎯',
    badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
    description: '4-Corner Pursuit, Hawk Tackle & Goal Line Stand',
  },
  TACKLE: {
    name: 'Form Fit Tackling',
    shortLabel: 'Tackling',
    icon: '🥋',
    badgeColor: 'bg-rose-600/20 text-rose-300 border-rose-500/30',
    description: 'Near Foot Strike, Hawk Roll Tackle, 10x10 Open Field Grid',
  },
  BLOCKING: {
    name: 'Blocking Technique',
    shortLabel: 'Blocking',
    icon: '🛡️',
    badgeColor: 'bg-teal-600/20 text-teal-300 border-teal-500/30',
    description: 'CUFF Progression, Board Fit & Perimeter Stalk',
  },
  ST: {
    name: 'Special Teams',
    shortLabel: 'Specials',
    icon: '🌟',
    badgeColor: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    description: 'Kickoff Lane Spacing, Punt Shield Protection & Gunners',
  },
  WARMUP: {
    name: 'Warm-Up & Agility',
    shortLabel: 'Warm-Up',
    icon: '🏃',
    badgeColor: 'bg-orange-600/20 text-orange-300 border-orange-500/30',
    description: 'Dynamic Lines, 4-Way Agility & Conditioning Gassers',
  },
  SCHEME: {
    name: 'Schemes & Stunts',
    shortLabel: 'Schemes',
    icon: '📋',
    badgeColor: 'bg-violet-600/20 text-violet-300 border-violet-500/30',
    description: '4-4 Base Liz, 5-3 Bear, Cover 3 Sky, Tampa 2 & Blitzes',
  },
};

export interface CascadingDrillFolder {
  key: DefensivePositionCategory;
  name: string;
  shortLabel: string;
  icon: string;
  badgeColor: string;
  borderActiveColor: string;
  bgActiveColor: string;
  accentBorder: string;
  description: string;
  subCategories?: DefensivePositionCategory[];
}

const CASCADING_DRILL_FOLDERS: CascadingDrillFolder[] = [
  {
    key: 'OFFENSE',
    name: 'Offense (27 Drills)',
    shortLabel: 'Offense',
    icon: '🏈',
    badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
    borderActiveColor: 'border-blue-500/80',
    bgActiveColor: 'bg-blue-700/60',
    accentBorder: 'border-blue-500/40',
    description: 'Quarterback drops, running back mesh, offensive line power steps, receiver routes & team install',
    subCategories: ['OFF_QB', 'OFF_RB', 'OFF_OL', 'OFF_WR', 'OFF_TEAM'],
  },
  {
    key: 'DEFENSE',
    name: 'Defense (43 Drills)',
    shortLabel: 'Defense',
    icon: '🛡️',
    badgeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    borderActiveColor: 'border-emerald-500/80',
    bgActiveColor: 'bg-emerald-700/60',
    accentBorder: 'border-emerald-500/40',
    description: 'D-Line shock & shed, edge containment, linebacker scrape, secondary trigger & team stunts/blitzes',
    subCategories: ['DL', 'DE', 'LB', 'DB', 'SCHEME'],
  },
  {
    key: 'TACKLE',
    name: 'Form Fit Tackling',
    shortLabel: 'Tackling',
    icon: '🥋',
    badgeColor: 'bg-rose-600/20 text-rose-300 border-rose-500/30',
    borderActiveColor: 'border-rose-500/80',
    bgActiveColor: 'bg-rose-700/60',
    accentBorder: 'border-rose-500/40',
    description: 'Near Foot Strike, Hawk Roll Tackle, 10x10 Open Field Grid',
  },
  {
    key: 'BLOCKING',
    name: 'Blocking Technique',
    shortLabel: 'Blocking',
    icon: '🧱',
    badgeColor: 'bg-teal-600/20 text-teal-300 border-teal-500/30',
    borderActiveColor: 'border-teal-500/80',
    bgActiveColor: 'bg-teal-700/60',
    accentBorder: 'border-teal-500/40',
    description: 'CUFF Progression, Board Fit & Perimeter Stalk',
  },
  {
    key: 'ST',
    name: 'Special Teams',
    shortLabel: 'Specials',
    icon: '🌟',
    badgeColor: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    borderActiveColor: 'border-yellow-500/80',
    bgActiveColor: 'bg-yellow-700/60',
    accentBorder: 'border-yellow-500/40',
    description: 'Kickoff Lane Spacing, Punt Shield Protection & Gunners',
  },
  {
    key: 'WARMUP',
    name: 'Warm-Up & Agility',
    shortLabel: 'Warm-Up',
    icon: '🏃',
    badgeColor: 'bg-orange-600/20 text-orange-300 border-orange-500/30',
    borderActiveColor: 'border-orange-500/80',
    bgActiveColor: 'bg-orange-700/60',
    accentBorder: 'border-orange-500/40',
    description: 'Dynamic Lines, 4-Way Agility & Conditioning Gassers',
  },
  {
    key: 'TEAM',
    name: 'Team Circuits & Walkthroughs',
    shortLabel: 'Team Defense',
    icon: '🎯',
    badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
    borderActiveColor: 'border-amber-500/80',
    bgActiveColor: 'bg-amber-700/60',
    accentBorder: 'border-amber-500/40',
    description: '4-Corner Pursuit, Hawk Tackle & Goal Line Stand',
  },
];

const POSITION_CATEGORIES: DefensivePositionCategory[] = [
  'OFFENSE',
  'DEFENSE',
  'OFF_QB',
  'OFF_RB',
  'OFF_OL',
  'OFF_WR',
  'OFF_TEAM',
  'DL',
  'DE',
  'LB',
  'DB',
  'SCHEME',
  'TACKLE',
  'BLOCKING',
  'ST',
  'WARMUP',
  'TEAM',
];

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
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
  activeWhiteboardDrillId,
  activeWhiteboardCategory,
  onSelectWhiteboardDrill,
  onSelectWhiteboardCategory,
  activeTeam,
  guideTree,
  onSelectGuideMain,
  isExpanded: controlledIsExpanded,
  onToggleExpanded: controlledOnToggleExpanded,
}) => {
  // Sidebar expanded / collapsed state
  const [internalExpanded, setInternalExpanded] = useState<boolean>(() => {
    return safeJSONParse<boolean>('footballSidebarExpanded', false);
  });

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalExpanded;

  // Custom Logo Modal & Configuration State
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [logoConfig, setLogoConfig] = useState<TeamLogoConfig>(() => {
    const teamKey = activeTeam?.id ? `coach_team_custom_logo_${activeTeam.id}` : 'coach_team_custom_logo_v1';
    const saved = safeJSONParse<TeamLogoConfig | null>(teamKey, null);
    return saved || DEFAULT_TEAM_LOGO;
  });

  // Re-sync if activeTeam changes
  useEffect(() => {
    const teamKey = activeTeam?.id ? `coach_team_custom_logo_${activeTeam.id}` : 'coach_team_custom_logo_v1';
    const saved = safeJSONParse<TeamLogoConfig | null>(teamKey, null);
    if (saved) {
      setLogoConfig(saved);
    }
  }, [activeTeam?.id]);

  const handleSaveLogoConfig = (newConfig: TeamLogoConfig) => {
    setLogoConfig(newConfig);
    const teamKey = activeTeam?.id ? `coach_team_custom_logo_${activeTeam.id}` : 'coach_team_custom_logo_v1';
    safeJSONSet(teamKey, newConfig);
  };

  const toggleSidebar = () => {
    if (controlledOnToggleExpanded) {
      controlledOnToggleExpanded();
    } else {
      setInternalExpanded((prev) => {
        const next = !prev;
        safeJSONSet('footballSidebarExpanded', next);
        return next;
      });
    }
  };

  // Cascading folders expanded state inside the sidebar
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    drills_main: true,
    drills_OFFENSE: true,
    drills_OFF_QB: false,
    drills_OFF_RB: false,
    drills_OFF_OL: false,
    drills_OFF_WR: false,
    drills_OFF_TEAM: false,
    drills_LB: true, // Default open LB so youth blitz drills are immediately accessible
    depth_chart_main: true,
    game_day_main: false,
    playbook_main: false,
  });

  const [drillSearchFilter, setDrillSearchFilter] = useState('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<any>(null);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  const [drillsVersion, setDrillsVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setDrillsVersion((v) => v + 1);
    window.addEventListener('football_whiteboard_drills_updated', handleUpdate);
    return () => window.removeEventListener('football_whiteboard_drills_updated', handleUpdate);
  }, []);

  // Group drills by positionCategory
  const groupedDrills = useMemo(() => {
    const map: Record<DefensivePositionCategory, WhiteboardDrill[]> = {
      OFFENSE: [],
      OFF_QB: [],
      OFF_RB: [],
      OFF_OL: [],
      OFF_WR: [],
      OFF_TEAM: [],
      DEFENSE: [],
      DL: [],
      DE: [],
      LB: [],
      DB: [],
      TEAM: [],
      TACKLE: [],
      BLOCKING: [],
      ST: [],
      WARMUP: [],
      SCHEME: [],
    };

    const effectiveDrills = loadEffectiveWhiteboardDrills();
    effectiveDrills.forEach((drill) => {
      const cat = (drill.category as DefensivePositionCategory) || 'LB';
      if (map[cat]) {
        map[cat].push(drill);
      } else {
        map.SCHEME.push(drill);
      }
      // Also collect under OFFENSE so the master Offense folder shows the complete total of 27 drills
      if (cat.startsWith('OFF_')) {
        map.OFFENSE.push(drill);
      }
      // Also collect under DEFENSE so the master Defense folder shows all defense drills
      if (['DL', 'DE', 'LB', 'DB', 'SCHEME'].includes(cat)) {
        map.DEFENSE.push(drill);
      }
    });

    return map;
  }, [drillsVersion]);

  // Helper to expand folder hierarchy for a category
  const expandCategoryHierarchy = (category: 'ALL' | DefensivePositionCategory) => {
    if (category === 'ALL') {
      setExpandedFolders((prev) => ({
        ...prev,
        drills_main: true,
      }));
      return;
    }
    setExpandedFolders((prev) => {
      const next = {
        ...prev,
        drills_main: true,
        [`drills_${category}`]: true,
      };
      if (category.startsWith('OFF_') || category === 'OFFENSE') {
        next.drills_OFFENSE = true;
      }
      if (['DL', 'DE', 'LB', 'DB', 'SCHEME', 'DEFENSE'].includes(category)) {
        next.drills_DEFENSE = true;
      }
      return next;
    });
  };

  // AUTO-EXPANSION REQUIREMENT:
  // "Include a way that it expands when clicking drills from positions in the other tabs, so the cascading tabs expand from main folder"
  useEffect(() => {
    if (activeWhiteboardCategory) {
      expandCategoryHierarchy(activeWhiteboardCategory);
    }
  }, [activeWhiteboardCategory]);

  useEffect(() => {
    if (activeWhiteboardDrillId) {
      const effectiveDrills = loadEffectiveWhiteboardDrills();
      const activeDrill = effectiveDrills.find((d) => d.id === activeWhiteboardDrillId);
      if (activeDrill) {
        expandCategoryHierarchy(activeDrill.category);
      }
    }
  }, [activeWhiteboardDrillId]);

  // When activeUnit changes to whiteboard or drills, ensure main folder is expanded
  useEffect(() => {
    if (activeUnit === 'whiteboard' || activeUnit === 'drills') {
      setExpandedFolders((prev) => ({
        ...prev,
        drills_main: true,
      }));
    } else if (['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live', 'depth_chart'].includes(activeUnit)) {
      setExpandedFolders((prev) => ({
        ...prev,
        depth_chart_main: true,
      }));
    } else if (['game_day', 'wristband', 'call_sheet', 'scouting', 'tendencies', 'html_tendencies'].includes(activeUnit)) {
      setExpandedFolders((prev) => ({
        ...prev,
        game_day_main: true,
      }));
    } else if (activeUnit === 'guide') {
      setExpandedFolders((prev) => ({
        ...prev,
        playbook_main: true,
      }));
    }
  }, [activeUnit]);

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  const handleHoverEnter = (itemId: string) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredItemId(itemId);
  };

  const handleHoverLeave = () => {
    const timeout = setTimeout(() => {
      setHoveredItemId(null);
    }, 120);
    setHoverTimeout(timeout);
  };

  const handleItemClick = (id: UnitType) => {
    if (id === 'depth_chart') {
      const targetSub = depthSubUnit || 'offense';
      if (onSelectDepthSubUnit) onSelectDepthSubUnit(targetSub);
      onSelectUnit(targetSub);
    } else if (id === 'offense' || id === 'defense') {
      if (onSelectDepthSubUnit) onSelectDepthSubUnit(id);
      onSelectUnit(id);
    } else {
      onSelectUnit(id);
    }
  };

  const handleDrillClick = (drillId: string, category: DefensivePositionCategory) => {
    if (onSelectWhiteboardDrill) {
      onSelectWhiteboardDrill(drillId, category);
    } else {
      if (onSelectWhiteboardCategory) onSelectWhiteboardCategory(category);
      onSelectUnit('whiteboard');
    }
  };

  const handleCategoryClick = (category: DefensivePositionCategory) => {
    toggleFolder(`drills_${category}`);
    if (onSelectWhiteboardCategory) {
      onSelectWhiteboardCategory(category);
    }
    onSelectUnit('whiteboard');
  };

  // Check if an item is active
  const isItemActive = (id: UnitType) => {
    if (id === 'depth_chart') {
      return ['depth_chart', 'offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(activeUnit);
    }
    if (id === 'offense') {
      return activeUnit === 'offense' || (activeUnit === 'depth_chart' && depthSubUnit === 'offense');
    }
    if (id === 'defense') {
      return activeUnit === 'defense' || (activeUnit === 'depth_chart' && depthSubUnit === 'defense');
    }
    if (id === 'whiteboard') {
      return activeUnit === 'whiteboard' || activeUnit === 'drills';
    }
    if (id === 'game_day') {
      return ['game_day', 'wristband', 'call_sheet', 'scouting', 'tendencies', 'html_tendencies'].includes(activeUnit);
    }
    return activeUnit === id;
  };

  return (
    <>
      <aside
        id="side-navigation-folder-system"
        className={`hidden md:flex bg-slate-950 border-r border-slate-800 h-screen sticky top-0 flex-col z-40 transition-all duration-300 select-none print:hidden shadow-2xl ${
          isExpanded ? 'w-80 min-w-[320px]' : 'w-18 min-w-[72px]'
        }`}
      >
        {/* ===================================================================
            TOP SIDEBAR HEADER: TEAM LOGO & EXPAND/COLLAPSE TOGGLE
            Separated layout prevents toggle button from covering the logo
            =================================================================== */}
        {isExpanded ? (
          <div className="h-16 px-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/60 gap-2">
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
              {/* Team Crest / Logo with hover customizer trigger */}
              <div
                onClick={() => setIsLogoModalOpen(true)}
                title="Click to customize team crest / logo"
                className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${logoConfig.gradientClass} border border-white/20 flex items-center justify-center shadow-lg shadow-indigo-950/50 cursor-pointer hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all shrink-0 ring-1 ring-white/10 relative group overflow-hidden`}
              >
                {logoConfig.mode === 'image' && logoConfig.imageUrl ? (
                  <img src={logoConfig.imageUrl} alt="Team Logo" className="w-full h-full object-cover" />
                ) : logoConfig.mode === 'emoji' ? (
                  <span className="text-xl select-none">{logoConfig.emoji || '🏈'}</span>
                ) : (
                  <span className="text-white font-black text-xl tracking-tighter select-none font-serif">
                    {logoConfig.letterText || 'M'}
                  </span>
                )}
                {/* Camera / Edit Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex flex-col justify-center animate-in fade-in duration-200">
                <span className="text-xs font-black text-white tracking-tight truncate leading-tight">
                  {activeTeam ? activeTeam.name : 'Mahopac Football'}
                </span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <span>Folder Directory</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </span>
              </div>
            </div>

            {/* Collapse Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse to icon bar"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer border border-transparent hover:border-slate-700 shrink-0"
            >
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        ) : (
          <div className="py-3 px-2 border-b border-slate-800/80 flex flex-col items-center justify-center gap-2.5 shrink-0 bg-slate-950/60">
            {/* Centered Crest with hover camera icon */}
            <div
              onClick={() => setIsLogoModalOpen(true)}
              title="Click to customize team crest / logo"
              className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${logoConfig.gradientClass} border border-white/20 flex items-center justify-center shadow-lg shadow-indigo-950/50 cursor-pointer hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all shrink-0 ring-1 ring-white/10 relative group overflow-hidden`}
            >
              {logoConfig.mode === 'image' && logoConfig.imageUrl ? (
                <img src={logoConfig.imageUrl} alt="Team Logo" className="w-full h-full object-cover" />
              ) : logoConfig.mode === 'emoji' ? (
                <span className="text-xl select-none">{logoConfig.emoji || '🏈'}</span>
              ) : (
                <span className="text-white font-black text-xl tracking-tighter select-none font-serif">
                  {logoConfig.letterText || 'M'}
                </span>
              )}
              {/* Camera / Edit Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Dedicated Expand Button neatly positioned UNDER the logo - NEVER overlapping */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand cascading folder tree"
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer border border-slate-800/80 hover:border-slate-700 shrink-0 flex items-center justify-center shadow-xs"
            >
              <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        )}

        {/* ===================================================================
            SEARCH BAR (WHEN SIDEBAR IS EXPANDED)
            =================================================================== */}
        {isExpanded && (
          <div className="px-3 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={drillSearchFilter}
                onChange={(e) => setDrillSearchFilter(e.target.value)}
                placeholder="Search drills, plays, schemes..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
              {drillSearchFilter && (
                <button
                  type="button"
                  onClick={() => setDrillSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            SCROLLABLE SIDEBAR NAVIGATION & CASCADING FOLDERS
            =================================================================== */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {MAIN_NAV_ITEMS.map((item) => {
            if (item.adminOnly && userRole !== 'admin') return null;

            const Icon = item.icon;
            const active = isItemActive(item.id);
            const isDefault = defaultScreen === item.id;

            // ===============================================================
            // SPECIAL CASCADING EXPANSION: DRILL LIBRARY & WHITEBOARD FOLDER
            // ===============================================================
            if (item.id === 'whiteboard') {
              const isFolderOpen = expandedFolders.drills_main;
              const totalDrillCount = Object.values(groupedDrills).reduce((acc, l) => acc + l.length, 0);

              return (
                <div key={item.id} className="relative group">
                  {/* Main Folder Tab Header */}
                  <div
                    onMouseEnter={() => handleHoverEnter(item.id)}
                    onMouseLeave={handleHoverLeave}
                    onClick={() => {
                      if (!isExpanded) {
                        // In collapsed mode, navigate to whiteboard and expand
                        toggleSidebar();
                        onSelectUnit('whiteboard');
                      } else {
                        toggleFolder('drills_main');
                        onSelectUnit('whiteboard');
                      }
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      active
                        ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/30 border-indigo-400 ring-1 ring-indigo-400/40'
                        : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-slate-200/90 hover:border-slate-300 dark:border-slate-800/80 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
                      {isFolderOpen ? (
                        <FolderOpen
                          className={`w-5 h-5 transition-transform ${
                            active ? 'text-white' : 'text-amber-400'
                          }`}
                        />
                      ) : (
                        <Folder
                          className={`w-5 h-5 transition-transform ${
                            active ? 'text-white' : 'text-amber-400'
                          }`}
                        />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-black truncate">{item.label}</span>
                          <span
                            className={`text-[10px] font-bold ${
                              active ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            Youth Drills & Krausko Blitz
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isFolderOpen ? 'rotate-90 text-white' : 'text-slate-500'
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cascading Sub-Folders under Drills (Position Groups & Drill Stations) */}
                  {isExpanded && isFolderOpen && (
                    <div className="mt-1.5 ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Top Action Bar for Quick Whiteboard Mode */}
                      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Position & Drill Matrix Tree</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUnit('drills');
                          }}
                          className="text-indigo-400 hover:text-indigo-200 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Dumbbell className="w-3 h-3" />
                          <span>Drill Matrix</span>
                        </button>
                      </div>

                      {/* Position Groups Cascading Folders */}
                      {CASCADING_DRILL_FOLDERS.map((folder) => {
                        const drillsInFolder = groupedDrills[folder.key] || [];
                        const isFolderOpen = expandedFolders[`drills_${folder.key}`];
                        const isFolderSelected =
                          activeWhiteboardCategory === folder.key && activeUnit === 'whiteboard';

                        const hasSubCategories = folder.subCategories && folder.subCategories.length > 0;

                        // Check search matching
                        let matchingCount = 0;
                        if (hasSubCategories) {
                          folder.subCategories!.forEach((subCat) => {
                            const subDrills = groupedDrills[subCat] || [];
                            const matches = drillSearchFilter.trim()
                              ? subDrills.filter((d) =>
                                  d.title.toLowerCase().includes(drillSearchFilter.toLowerCase())
                                )
                              : subDrills;
                            matchingCount += matches.length;
                          });
                        } else {
                          const matches = drillSearchFilter.trim()
                            ? drillsInFolder.filter((d) =>
                                d.title.toLowerCase().includes(drillSearchFilter.toLowerCase())
                              )
                            : drillsInFolder;
                          matchingCount += matches.length;
                        }

                        if (drillSearchFilter.trim() && matchingCount === 0) {
                          return null;
                        }

                        return (
                          <div key={folder.key} className="space-y-1">
                            {/* Top-Level Unit / Position Master Folder */}
                            <div
                              onClick={() => handleCategoryClick(folder.key)}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all border text-xs font-bold ${
                                isFolderSelected
                                  ? `${folder.bgActiveColor} text-white ${folder.borderActiveColor} shadow-xs`
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-800/80 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-slate-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm select-none">{folder.icon}</span>
                                <span className="truncate">{folder.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-300 dark:border-slate-700/60 font-bold">
                                  {drillsInFolder.length}
                                </span>
                                <ChevronRight
                                  className={`w-3 h-3 transition-transform ${
                                    isFolderOpen ? 'rotate-90 text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Cascading Content: Sub-folders or Direct Drills */}
                            {isFolderOpen && (
                              hasSubCategories ? (
                                <div className={`ml-3 pl-2.5 border-l-2 ${folder.accentBorder} space-y-1.5 py-1`}>
                                  {folder.subCategories!.map((subCat) => {
                                    const subInfo = POSITION_CATEGORY_INFO[subCat];
                                    const subDrills = groupedDrills[subCat] || [];
                                    const isSubOpen = expandedFolders[`drills_${subCat}`];
                                    const isSubSelected =
                                      activeWhiteboardCategory === subCat && activeUnit === 'whiteboard';

                                    const filteredSubDrills = drillSearchFilter.trim()
                                      ? subDrills.filter((d) =>
                                          d.title.toLowerCase().includes(drillSearchFilter.toLowerCase())
                                        )
                                      : subDrills;

                                    if (drillSearchFilter.trim() && filteredSubDrills.length === 0) {
                                      return null;
                                    }

                                    return (
                                      <div key={subCat} className="space-y-1">
                                        {/* Position Sub-Folder */}
                                        <div
                                          onClick={() => handleCategoryClick(subCat)}
                                          className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all border text-xs font-semibold ${
                                            isSubSelected
                                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-slate-800'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-sm select-none">{subInfo.icon}</span>
                                            <span className="truncate">{subInfo.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono border border-indigo-200 dark:border-indigo-900/60 font-bold">
                                              {subDrills.length}
                                            </span>
                                            <ChevronRight
                                              className={`w-3 h-3 transition-transform ${
                                                isSubOpen ? 'rotate-90 text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                                              }`}
                                            />
                                          </div>
                                        </div>

                                        {/* Individual Drills under Sub-Position */}
                                        {isSubOpen && (
                                          <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-700/50 space-y-1 py-1">
                                            {filteredSubDrills.map((drill) => {
                                              const isDrillActive =
                                                activeWhiteboardDrillId === drill.id && activeUnit === 'whiteboard';
                                              const isKrausko = drill.id.includes('krausko');
                                              return (
                                                <div
                                                  key={drill.id}
                                                  onClick={() => handleDrillClick(drill.id, subCat)}
                                                  className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all text-[11px] group/drill ${
                                                    isDrillActive
                                                      ? 'bg-indigo-600 text-white font-black shadow-xs ring-1 ring-indigo-400/60'
                                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    {isKrausko && (
                                                      <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 animate-pulse" />
                                                    )}
                                                    <span className="truncate">{drill.title}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/drill:opacity-100">
                                                    <span className="text-[9px] font-mono uppercase px-1 rounded bg-slate-200 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold">
                                                      {drill.phases.length}p
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className={`ml-3 pl-2.5 border-l-2 ${folder.accentBorder} space-y-1 py-1`}>
                                  {drillsInFolder
                                    .filter((d) =>
                                      drillSearchFilter.trim()
                                        ? d.title.toLowerCase().includes(drillSearchFilter.toLowerCase())
                                        : true
                                    )
                                    .map((drill) => {
                                      const isDrillActive =
                                        activeWhiteboardDrillId === drill.id && activeUnit === 'whiteboard';
                                      const isKrausko = drill.id.includes('krausko');

                                      return (
                                        <div
                                          key={drill.id}
                                          onClick={() => handleDrillClick(drill.id, folder.key)}
                                          className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all text-[11px] group/drill ${
                                            isDrillActive
                                              ? 'bg-indigo-600 text-white font-black shadow-xs ring-1 ring-indigo-400/50'
                                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {isKrausko && (
                                              <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 animate-pulse" />
                                            )}
                                            <span className="truncate">{drill.title}</span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/drill:opacity-100">
                                            <span className="text-[9px] font-mono uppercase px-1 rounded bg-slate-200 dark:bg-slate-800/80 text-slate-700 dark:text-slate-400 font-bold">
                                              {drill.phases.length}p
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rich Hover Detail Popover (When Sidebar is collapsed) */}
                  {!isExpanded && hoveredItemId === item.id && (
                    <div
                      className="absolute left-full top-0 ml-3 w-80 bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-md"
                      onMouseEnter={() => handleHoverEnter(item.id)}
                      onMouseLeave={handleHoverLeave}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📁</span>
                          <div>
                            <h4 className="text-sm font-black text-white leading-tight">
                              {item.label}
                            </h4>
                            <span className="text-[10px] text-indigo-400 font-bold">
                              Cascading Folder System
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-400/30">
                          {totalDrillCount} Drills
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Cascading Position Groups:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {POSITION_CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                handleCategoryClick(cat);
                                setHoveredItemId(null);
                              }}
                              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-left text-xs font-bold text-slate-200 hover:text-white transition-colors flex items-center justify-between cursor-pointer border border-slate-700/60"
                            >
                              <span className="truncate">
                                {POSITION_CATEGORY_INFO[cat].icon} {cat}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {groupedDrills[cat]?.length || 0}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            toggleSidebar();
                            onSelectUnit('whiteboard');
                            setHoveredItemId(null);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-200 font-black flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open Full Tree</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectUnit('whiteboard');
                            setHoveredItemId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 cursor-pointer shadow-xs"
                        >
                          Launch Board
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // ===============================================================
            // SPECIAL CASCADING EXPANSION: DEPTH CHART / FORMATIONS FOLDER
            // ===============================================================
            if (item.id === 'depth_chart') {
              const isDepthChartOpen = expandedFolders.depth_chart_main;

              return (
                <div key={item.id} className="relative group">
                  <div
                    onMouseEnter={() => handleHoverEnter(item.id)}
                    onMouseLeave={handleHoverLeave}
                    onClick={() => {
                      if (!isExpanded) {
                        handleItemClick(item.id);
                      } else {
                        toggleFolder('depth_chart_main');
                        handleItemClick(item.id);
                      }
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      active
                        ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/30 border-indigo-400 ring-1 ring-indigo-400/40'
                        : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-slate-200/90 hover:border-slate-300 dark:border-slate-800/80 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
                      <Layers
                        className={`w-5 h-5 ${active ? 'text-white stroke-[2.5]' : 'text-indigo-600 dark:text-indigo-400'}`}
                      />
                    </div>

                    {isExpanded && (
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-black truncate">{item.label}</span>
                          <span
                            className={`text-[10px] font-bold ${
                              active ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            Formations, Fronts & Rotation
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isDepthChartOpen ? 'rotate-90 text-white' : 'text-slate-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Cascading Sub-Items for Formations & Depth Chart */}
                  {isExpanded && isDepthChartOpen && (
                    <div className="mt-1.5 ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      {[
                        { id: 'offense', label: '🏈 Offense Formations & Slots' },
                        { id: 'defense', label: '🛡️ Defense Fronts & Coverage' },
                        { id: 'st', label: '⚡ Special Teams (KOR, Punt)' },
                        { id: 'groups', label: '👥 Position Groups Matrix' },
                        { id: 'scrimmage', label: '⚔️ 11v11 Scrimmage & Rotation' },
                        { id: 'practice_live', label: '🔥 7v7 / 11v11 Practice Drills' },
                      ].map((sub) => {
                        const isSubActive =
                          activeUnit === sub.id || (activeUnit === 'depth_chart' && depthSubUnit === sub.id);
                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              if (onSelectDepthSubUnit) {
                                onSelectDepthSubUnit(sub.id as any);
                              }
                              onSelectUnit(sub.id as any);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-bold ${
                              isSubActive
                                ? 'bg-indigo-600 text-white font-black shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <span>{sub.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover Details for Depth Chart */}
                  {!isExpanded && hoveredItemId === item.id && (
                    <div
                      className="absolute left-full top-0 ml-3 w-76 bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-md"
                      onMouseEnter={() => handleHoverEnter(item.id)}
                      onMouseLeave={handleHoverLeave}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-indigo-400" />
                          <h4 className="text-sm font-black text-white">{item.label}</h4>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black">
                          Formations
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Sub-Units:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            { id: 'offense', label: '🏈 Offense' },
                            { id: 'defense', label: '🛡️ Defense' },
                            { id: 'st', label: '⚡ Special Teams' },
                            { id: 'groups', label: '👥 Groups' },
                            { id: 'scrimmage', label: '⚔️ Scrimmage' },
                            { id: 'practice_live', label: '🔥 7v7 / 11v11 Drills' },
                          ].map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                if (onSelectDepthSubUnit) onSelectDepthSubUnit(s.id as any);
                                onSelectUnit(s.id as any);
                                setHoveredItemId(null);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-[11px] font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // ===============================================================
            // SPECIAL CASCADING EXPANSION: GAME DAY HUB (SIDELINE HUD, CALL SHEET, WRISTBANDS, SCOUTING, TENDENCIES)
            // ===============================================================
            if (item.id === 'game_day') {
              const isGameDayOpen = expandedFolders.game_day_main;
              const isGameDayActive = isItemActive('game_day');

              return (
                <div key={item.id} className="relative group">
                  <div
                    onMouseEnter={() => handleHoverEnter(item.id)}
                    onMouseLeave={handleHoverLeave}
                    onClick={() => {
                      if (!isExpanded) {
                        handleItemClick(item.id);
                      } else {
                        toggleFolder('game_day_main');
                        handleItemClick(item.id);
                      }
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      isGameDayActive
                        ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/30 border-red-400 ring-1 ring-red-400/40'
                        : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-slate-200/90 hover:border-slate-300 dark:border-slate-800/80 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center w-7 h-7">
                      <Swords
                        className={`w-5 h-5 ${isGameDayActive ? 'text-white stroke-[2.5]' : 'text-red-600 dark:text-red-400'}`}
                      />
                    </div>

                    {isExpanded && (
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-black truncate">{item.label}</span>
                          <span
                            className={`text-[10px] font-bold ${
                              isGameDayActive ? 'text-red-200' : 'text-slate-400'
                            }`}
                          >
                            Live Sideline HUD & Plays
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isGameDayOpen ? 'rotate-90 text-white' : 'text-slate-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Cascading Sub-Items for Game Day Hub */}
                  {isExpanded && isGameDayOpen && (
                    <div className="mt-1.5 ml-3 pl-3 border-l-2 border-red-500/30 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      {[
                        { id: 'game_day', label: '⚡ Sideline HUD & Clock' },
                        { id: 'call_sheet', label: '🏈 Sideline Call Sheet' },
                        { id: 'wristband', label: '⌚ Wristband Inserts' },
                        { id: 'hudl_scout', label: '📊 Hudl Scout' },
                        { id: 'tendencies', label: '📈 Formations & Tendencies' },
                      ].map((sub) => {
                        const isSubActive = activeUnit === sub.id;
                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              onSelectUnit(sub.id as any);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-bold flex items-center gap-1.5 ${
                              isSubActive
                                ? 'bg-red-600 text-white font-black shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <span>{sub.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover Details for Game Day Hub when collapsed */}
                  {!isExpanded && hoveredItemId === item.id && (
                    <div
                      className="absolute left-full top-0 ml-3 w-76 bg-slate-900 border border-red-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-md"
                      onMouseEnter={() => handleHoverEnter(item.id)}
                      onMouseLeave={handleHoverLeave}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Swords className="w-5 h-5 text-red-400" />
                          <h4 className="text-sm font-black text-white">{item.label}</h4>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black">
                          Sideline Hub
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Sub-Tabs:
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            { id: 'game_day', label: '⚡ Sideline HUD' },
                            { id: 'call_sheet', label: '🏈 Call Sheet' },
                            { id: 'wristband', label: '⌚ Wristbands' },
                            { id: 'hudl_scout', label: '📊 Hudl Scout' },
                            { id: 'tendencies', label: '📈 Tendencies' },
                          ].map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                onSelectUnit(s.id as any);
                                setHoveredItemId(null);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-red-600 text-[11px] font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // ===============================================================
            // STANDARD NAVIGATION ITEM (WITH RICH HOVER CARD)
            // ===============================================================
            return (
              <div key={item.id} className="relative group">
                <div
                  onMouseEnter={() => handleHoverEnter(item.id)}
                  onMouseLeave={handleHoverLeave}
                  onClick={() => handleItemClick(item.id)}
                  className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all border active:scale-98 ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-lg shadow-indigo-600/30 border-indigo-400 ring-1 ring-indigo-400/40'
                      : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border-slate-200/90 hover:border-slate-300 dark:border-slate-800/80 dark:hover:border-slate-700 shadow-xs'
                  }`}
                >
                  <div className="shrink-0 flex items-center justify-center w-7 h-7">
                    <Icon
                      className={`w-5 h-5 ${
                        active ? 'text-white stroke-[2.5]' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                      }`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-black truncate">{item.label}</span>
                        <span
                          className={`text-[10px] font-medium truncate ${
                            active ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {item.shortLabel}
                        </span>
                      </div>

                      {item.badgeText && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                          }`}
                        >
                          {item.badgeText}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Rich Hover Detail Popover for Standard Items */}
                {!isExpanded && hoveredItemId === item.id && (
                  <div
                    className="absolute left-full top-0 ml-3 w-72 bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 backdrop-blur-md"
                    onMouseEnter={() => handleHoverEnter(item.id)}
                    onMouseLeave={handleHoverLeave}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-indigo-400" />
                        <h4 className="text-sm font-black text-white leading-tight">
                          {item.label}
                        </h4>
                      </div>
                      {item.badgeText && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-400/30">
                          {item.badgeText}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isDefault ? '⭐ Default Screen' : 'Click to launch'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleItemClick(item.id);
                          setHoveredItemId(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 cursor-pointer shadow-xs"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ===================================================================
            SIDEBAR FOOTER: QUICK PREFERENCES & CUSTOM TABS MANAGER
            =================================================================== */}
        <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/90 flex flex-col gap-2">
          {isExpanded ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsManagerModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-slate-800 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Customize Folders</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsManagerModalOpen(true)}
              title="Folder Directory Settings & Custom Groups"
              className="w-full py-2 flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Tab Group Manager Modal */}
      <TabGroupManagerModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        customGroups={propCustomGroups || []}
        onSaveCustomGroups={(newGroups) => {
          if (onUpdateCustomGroups) onUpdateCustomGroups(newGroups);
        }}
        tabOrder={[]}
        onSaveTabOrder={() => {}}
        defaultScreen={defaultScreen}
        userRole={userRole}
        showCustomTabsOnMainBar={false}
        onToggleShowCustomTabsOnMainBar={() => {}}
      />

      {/* Custom Team Logo & Crest Modal */}
      <CustomLogoModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentConfig={logoConfig}
        onSave={handleSaveLogoConfig}
        teamName={activeTeam ? activeTeam.name : 'Mahopac Football'}
      />
    </>
  );
};
