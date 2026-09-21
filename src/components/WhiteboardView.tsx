import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PenTool,
  RotateCcw,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Printer,
  Sparkles,
  Download,
  BookOpen,
  Check,
  Layers,
  Shield,
  Target,
  FileText,
  Sliders,
  Folder,
  FolderOpen,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  SunMedium,
  X as CloseIcon,
  Flag,
  ListOrdered,
  Dumbbell,
  Calendar,
  Upload,
  Type,
  Circle,
  Square,
  Triangle,
  Star,
} from 'lucide-react';
import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble, WhiteboardTextElement, Team, UserRole, PracticePlan } from '../types';
import {
  DLINE_DRILLS,
  DEFENSIVE_DRILLS,
  DEFENSIVE_SCHEMES,
  TECHNIQUE_DRILLS,
  isDefensiveScheme,
  DEFENSIVE_POSITION_GROUPS,
  DefensivePositionCategory,
  PRESET_SCHEMES,
  WhiteboardDrill,
  loadEffectiveWhiteboardDrills,
  getCustomWhiteboardDrills,
  saveCustomWhiteboardDrills,
  getDeletedWhiteboardDrillIds,
  saveDeletedWhiteboardDrillIds,
  getDisabledWhiteboardDrillIds,
  toggleDrillWhiteboard,
} from './whiteboard/whiteboardDrillData';
import { WhiteboardCanvas } from './whiteboard/WhiteboardCanvas';
import { HudlPlaybookUploadModal } from './whiteboard/HudlPlaybookUploadModal';
import { printCleanHTML } from '../utils/printUtils';
import { printDrillSheet } from './whiteboard/drillPrintHelper';
import { spreadDiagramElements, WhiteboardSpreadMode } from './whiteboard/whiteboardSpreadHelper';
import { AddWhiteboardDrillModal } from './whiteboard/AddWhiteboardDrillModal';
import { WhiteboardDrillDescriptionView } from './whiteboard/WhiteboardDrillDescriptionView';
import { TriangleDrillWhiteboard } from './whiteboard/TriangleDrillWhiteboard';
import { WhiteboardDrillPickerModal } from './whiteboard/WhiteboardDrillPickerModal';
import { findDrillInPracticePlans } from '../utils/drillPlanLinking';
import { safeJSONParse, safeJSONSet } from '../services/storageService';

interface WhiteboardViewProps {
  userRole?: UserRole;
  activeTeam?: Team;
  onNavigateToGuide?: () => void;
  onNavigateToDrills?: () => void;
  onSaveToGuidePlaybook?: (mainFolder: string, subTabName: string, htmlContent: string) => void;
  externalDrillId?: string;
  externalCategory?: 'ALL' | DefensivePositionCategory;
  onDrillSelect?: (drillId: string, category: DefensivePositionCategory) => void;
  onCategorySelect?: (category: 'ALL' | DefensivePositionCategory) => void;
  onNavigateToPracticePlan?: (practiceId?: string, drillTitle?: string) => void;
  practices?: PracticePlan[];
  currentPracticeId?: string | null;
}

const DRILL_ICONS = ['🏈', '💥', '🔄', '🛡️', '🎯', '🧱', '👁️', '🚨', '⚡', '🦅', '🏹', '⚔️', '🧤', '🏃', '🦾', '🔥', '🏆'];

const POSITION_FOLDER_META: Record<
  DefensivePositionCategory,
  { name: string; shortLabel: string; icon: string; badgeColor: string; description: string }
> = {
  SCHEME: {
    name: 'Defensive Schemes & Shells',
    shortLabel: 'Schemes',
    icon: '📋',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    description: '4-4 Base Stack Liz, 5-3 Bear Youth, 4-3 Over Front, 6-2 Goal Line Wall, Cover 3 Sky, Cover 2 Tampa',
  },
  DL: {
    name: 'Defensive Tackles (DL / NT)',
    shortLabel: 'DL / DT',
    icon: '🏈',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700',
    description: 'A/B-Gap Fits, Ball Get-Off, Strike & Shed, NT 2-Gap Bullet & Spill, Double-Team Split',
  },
  DE: {
    name: 'Defensive Ends (DE / Edge)',
    shortLabel: 'DE / Edge',
    icon: '⚡',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
    description: 'Outside Containment Stiff-Arm, Hoop Bend & Flatten, Backside Squeeze & Settle, Contain-Crash Stunt',
  },
  LB: {
    name: 'Linebackers (LB / Box & Edge)',
    shortLabel: 'Linebackers',
    icon: '💥',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    description: '6-Inch Freeze Step, Scrape-and-Spill Pulling Guard, Inside-Out Mirror & Scrape, Pass-Off Zone Drops',
  },
  DB: {
    name: 'Defensive Backs (DB / Secondary)',
    shortLabel: 'Secondary',
    icon: '🦅',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    description: 'Fast Alley Trigger, Open-Field Force & Alley Tackle, Centerfield Post Break, 45° Backpedal, Tip Turnover Circuit',
  },
  TEAM: {
    name: 'Team Tackling & Circuits',
    shortLabel: 'Team Defense',
    icon: '🎯',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    description: '4-Corner Pursuit & Swarm, Hawk Profile Tackle, 3-Man Turnover Relay, Goal Line Stand (4th & Inches)',
  },
  OFFENSE: {
    name: 'Offense (All Units)',
    shortLabel: 'Offense',
    icon: '🏈',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    description: 'Quarterback drops, running back mesh paths, offensive line power steps, receiver routes & team install',
  },
  DEFENSE: {
    name: 'Defense (All Units)',
    shortLabel: 'Defense',
    icon: '🛡️',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Defensive tackles, edge containment, linebacker scrape, secondary trigger, stunts & team schemes',
  },
  OFF_QB: {
    name: 'Quarterbacks (QB)',
    shortLabel: 'QB',
    icon: '🎯',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    description: 'Under-center drop, shotgun quick game, play-action bootleg mesh, and target net drills',
  },
  OFF_RB: {
    name: 'Running Backs (RB)',
    shortLabel: 'RB',
    icon: '💨',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    description: 'Handoff mesh, downhill A/B gap press, running back gauntlet, and perimeter outside zone',
  },
  OFF_OL: {
    name: 'Offensive Line (OL)',
    shortLabel: 'OL',
    icon: '🧱',
    badgeColor: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/60 dark:text-stone-300 dark:border-stone-700',
    description: '6-inch power step, drive blocking under chute, pulling guard trap technique, and 2-step footwork',
  },
  OFF_WR: {
    name: 'Wide Receivers & Tight Ends (WR/TE)',
    shortLabel: 'WR/TE',
    icon: '⚡',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    description: '2-point stance release, route tree landmarks, stalk blocking, diamond hands, and inline TE seal',
  },
  OFF_TEAM: {
    name: 'Team Offense & Group Install',
    shortLabel: 'Off Team',
    icon: '👥',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    description: 'Individual stance & legal alignment, QB-Center exchanges, walkthrough installs, and 11-on-11 scrimmage',
  },
  TACKLE: {
    name: 'Form Fit Tackling Circuits',
    shortLabel: 'Tackling',
    icon: '🥋',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    description: 'Near-foot drive, chest-to-chest fit, wrap & squeeze, and safe head-out form tackle drills',
  },
  BLOCKING: {
    name: 'Run & Pass Blocking Technique',
    shortLabel: 'Blocking',
    icon: '🛡️',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    description: 'Drive block 6-inch power step, double-team post-and-drive, zone combo climbing, and pass set punch',
  },
  ST: {
    name: 'Special Teams (Kick & Punt)',
    shortLabel: 'Special Teams',
    icon: '🌟',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    description: 'Kickoff lane containment, wedge breaking, punt snap protection, and gunner release technique',
  },
  WARMUP: {
    name: 'Dynamic Warm-Up & Agility',
    shortLabel: 'Warm-Up',
    icon: '🏃',
    badgeColor: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
    description: 'High knees, butt kicks, carioca, hip openers, lateral shuffles, and change-of-direction ladders',
  },
};

export const WhiteboardView: React.FC<WhiteboardViewProps> = ({
  userRole = 'admin',
  activeTeam,
  onNavigateToGuide,
  onNavigateToDrills,
  onSaveToGuidePlaybook,
  externalDrillId,
  externalCategory,
  onDrillSelect,
  onCategorySelect,
  onNavigateToPracticePlan,
  practices = [],
  currentPracticeId,
}) => {
  // Defensive Position Category Filter ('ALL' | 'SCHEME' | 'DL' | 'DE' | 'LB' | 'DB' | 'TEAM')
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | DefensivePositionCategory>(
    externalCategory || 'ALL'
  );

  // Mobile Drill View Mode: 'drill' (showing full-width chalkboard & notes) or 'list' (position and drill selector list)
  const [mobileViewMode, setMobileViewMode] = useState<'drill' | 'list'>('drill');
  const [drillSearchTerm, setDrillSearchTerm] = useState<string>('');

  // Mobile Drill Picker Modal
  const [isDrillPickerModalOpen, setIsDrillPickerModalOpen] = useState<boolean>(false);

  // Whiteboard Availability per drill (Allows coach to select / deselect drills to have whiteboard)
  const [disabledDrillIds, setDisabledDrillIds] = useState<string[]>(() => getDisabledWhiteboardDrillIds());

  // Folder Directory State: search, sorting, and collapsible accordion
  const [folderSearchQuery, setFolderSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<'position' | 'alpha' | 'phases'>('position');
  const [isFolderDirectoryOpen, setIsFolderDirectoryOpen] = useState<boolean>(true);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    SCHEME: true,
    DL: true,
    DE: true,
    LB: true,
    DB: true,
    TEAM: true,
    CUSTOM: true,
  });

  const toggleFolder = (folderKey: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  const expandAllFolders = () => {
    setOpenFolders({ SCHEME: true, DL: true, DE: true, LB: true, DB: true, TEAM: true, CUSTOM: true });
  };

  const collapseAllFolders = () => {
    setOpenFolders({ SCHEME: false, DL: false, DE: false, LB: false, DB: false, TEAM: false, CUSTOM: false });
  };

  // Dynamic Whiteboard Drills State
  const [drills, setDrills] = useState<WhiteboardDrill[]>(() => loadEffectiveWhiteboardDrills());
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const refreshDrills = () => {
    const updated = loadEffectiveWhiteboardDrills();
    setDrills(updated);
    window.dispatchEvent(new CustomEvent('football_whiteboard_drills_updated'));
  };

  useEffect(() => {
    const handleUpdate = () => {
      const updated = loadEffectiveWhiteboardDrills();
      setDrills(updated);
    };
    window.addEventListener('football_whiteboard_drills_updated', handleUpdate);
    return () => window.removeEventListener('football_whiteboard_drills_updated', handleUpdate);
  }, []);

  const handleHudlImport = (importedPlays: WhiteboardDrill[]) => {
    const formattedPlays = importedPlays.map((play) => ({
      ...play,
      category: 'SCHEME' as const,
      categoryLabel: play.categoryLabel || 'Hudl Defensive Scheme',
      phases: (play.phases || []).map((phase) => ({
        ...phase,
        tokens: phase.tokens.map((token) => {
          const isDef =
            token.id.startsWith('def-') ||
            ['E9', 'E5', 'T3', 'T1', 'DT', 'NT', 'DE', 'M', 'W', 'S', 'R', 'C', 'CB', 'FS', 'SS'].includes(token.label);
          if (isDef) {
            return {
              ...token,
              color: '#ef4444',
              fillMode: 'nofill' as const,
            };
          }
          return token;
        }),
      })),
    }));

    const existingCustom = getCustomWhiteboardDrills();
    const updatedCustom = [...existingCustom, ...formattedPlays];
    saveCustomWhiteboardDrills(updatedCustom);
    refreshDrills();
    if (formattedPlays.length > 0) {
      setLibraryMode('schemes');
      setSchemeSubFilter('all');
      setSelectedCategory('SCHEME');
      setActiveDrillId(formattedPlays[0].id);
      setActivePhaseIdx(0);
      setIsCustomMode(false);
    }
    showToast(`Successfully imported and redrew ${formattedPlays.length} Hudl defensive schemes!`);
  };

  // Primary Library Scope: Defensive Schemes (Hudl Plays) vs Technique Drills vs All
  const [libraryMode, setLibraryMode] = useState<'schemes' | 'drills' | 'all'>('schemes');
  const [schemeSubFilter, setSchemeSubFilter] = useState<'all' | 'base' | 'blitz' | 'stunts' | 'heavy'>('all');

  // Active Drill by ID or Custom Mode
  const [activeDrillId, setActiveDrillId] = useState<string>(() => {
    if (externalDrillId) return externalDrillId;
    const initial = loadEffectiveWhiteboardDrills();
    const firstScheme = initial.find(isDefensiveScheme);
    return firstScheme?.id || initial[0]?.id || 'drill-dl-ball-getoff';
  });
  const [activePhaseIdx, setActivePhaseIdx] = useState<number>(0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  // Sync external props if provided
  useEffect(() => {
    if (externalDrillId && externalDrillId !== activeDrillId) {
      setActiveDrillId(externalDrillId);
      setActivePhaseIdx(0);
      setIsCustomMode(false);
      setIsAutoPlaying(false);
      const matched = drills.find((d) => d.id === externalDrillId);
      if (matched?.category) {
        setSelectedCategory(matched.category);
        setOpenFolders((prev) => ({ ...prev, [matched.category]: true }));
      }
    }
  }, [externalDrillId, drills]);

  useEffect(() => {
    if (externalCategory && externalCategory !== selectedCategory) {
      setSelectedCategory(externalCategory);
      if (externalCategory !== 'ALL') {
        setOpenFolders((prev) => ({ ...prev, [externalCategory]: true }));
      }
    }
  }, [externalCategory]);

  // Active Tokens, Arrows, Zones, and Text on the board
  const [tokens, setTokens] = useState<WhiteboardToken[]>([]);
  const [arrows, setArrows] = useState<WhiteboardArrow[]>([]);
  const [zones, setZones] = useState<WhiteboardZoneBubble[]>([]);
  const [textElements, setTextElements] = useState<WhiteboardTextElement[]>([]);
  const [isHudlModalOpen, setIsHudlModalOpen] = useState<boolean>(false);

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'token' | 'arrow' | 'zone' | 'text' | null>(null);

  // Stamping / Tool mode
  const [stampMode, setStampMode] = useState<
    'none' | 'O' | 'X' | 'square' | 'triangle' | 'diamond' | 'star' | 'blitz' | 'zone' | 'circle_zone' | 'text'
  >('none');
  const [stampLabel, setStampLabel] = useState<string>('DE');
  const [stampColor, setStampColor] = useState<string>('#1d4ed8');
  const [stampFillMode, setStampFillMode] = useState<'fill' | 'nofill'>('fill');
  const [stampZoneShape, setStampZoneShape] = useState<'circle' | 'ellipse' | 'rect'>('circle');

  // Drawing Canvas State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#0052cc');
  const [penWidth, setPenWidth] = useState<number>(3.5);
  const sketchPadRef = useRef<HTMLCanvasElement | null>(null);

  // Whiteboard readability toggles (prevent clutter and overlapping labels)
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showCoachingInset, setShowCoachingInset] = useState<boolean>(false);
  const [spreadMode, setSpreadMode] = useState<WhiteboardSpreadMode>(() => {
    return safeJSONParse<WhiteboardSpreadMode>('footballWhiteboardSpacing', 'standard');
  });
  const [zoneShadeMode, setZoneShadeMode] = useState<'dim' | 'soft' | 'outline' | 'standard'>('dim');

  // Custom Objective / Notes state
  const [customTitle, setCustomTitle] = useState<string>('CUSTOM DEFENSIVE SCHEME');
  const [customObjective, setCustomObjective] = useState<string>(
    'Install blitz angles, front alignment, and pass rush lanes against opponent formations.'
  );
  const [customCues, setCustomCues] = useState<string[]>([
    'Attack with low pads & aggressive get-off',
    'Hold outside contain on rollouts',
    'Linebacker fills A-gap with high motor',
  ]);
  const [customFaults, setCustomFaults] = useState<string[]>([
    'Do not jump offsides on hard count',
    'Do not get washed out past the depth of the pocket',
  ]);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Filtered drills based on position category
  const filteredDrills = selectedCategory === 'ALL'
    ? DEFENSIVE_DRILLS
    : selectedCategory === 'OFFENSE'
    ? DEFENSIVE_DRILLS.filter((d) => d.category === 'OFFENSE' || d.category.startsWith('OFF_'))
    : DEFENSIVE_DRILLS.filter((d) => d.category === selectedCategory);

  // Check if a drill matches the search query
  const matchesSearch = (drill: WhiteboardDrill): boolean => {
    if (!folderSearchQuery.trim()) return true;
    const q = folderSearchQuery.toLowerCase();
    return (
      drill.title.toLowerCase().includes(q) ||
      drill.subtitle.toLowerCase().includes(q) ||
      drill.objective.toLowerCase().includes(q) ||
      drill.category.toLowerCase().includes(q) ||
      drill.categoryLabel.toLowerCase().includes(q) ||
      drill.cues.some((c) => c.toLowerCase().includes(q))
    );
  };

  // Sort helper for drills
  const sortDrills = (drills: WhiteboardDrill[]): WhiteboardDrill[] => {
    const list = [...drills];
    if (sortMode === 'alpha') {
      return list.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === 'phases') {
      return list.sort((a, b) => b.phases.length - a.phases.length);
    }
    return list;
  };

  // Drills organized into position folders with search and sort applied
  const folderData = useMemo(() => {
    const positionOrder: DefensivePositionCategory[] = ['SCHEME', 'DL', 'DE', 'LB', 'DB', 'TEAM'];
    return positionOrder.map((posKey) => {
      const allInPos = DEFENSIVE_DRILLS.filter((d) => d.category === posKey);
      const matchingDrills = sortDrills(allInPos.filter(matchesSearch));
      return {
        key: posKey,
        meta: POSITION_FOLDER_META[posKey],
        drills: matchingDrills,
        totalCount: allInPos.length,
      };
    });
  }, [folderSearchQuery, sortMode]);

  const currentDrill: WhiteboardDrill =
    drills.find((d) => d.id === activeDrillId) ||
    filteredDrills[0] ||
    drills[0] ||
    DEFENSIVE_DRILLS[0];

  // Match current drill with scheduled practice plan
  const matchingPracticePlanInfo = useMemo(() => {
    if (!currentDrill || !practices || practices.length === 0) return null;
    return findDrillInPracticePlans(currentDrill, practices, currentPracticeId);
  }, [currentDrill, practices, currentPracticeId]);

  // Filtered drills specifically for the Mobile/Sideline Position & Drill Selector List
  const listFilteredDrills = useMemo(() => {
    return drills.filter((drill) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'OFFENSE') {
          if (!drill.category.startsWith('OFF')) return false;
        } else if (selectedCategory === 'DEFENSE') {
          if (!['DL', 'DE', 'LB', 'DB', 'SCHEME', 'DEFENSE', 'TEAM', 'TACKLE'].includes(drill.category)) return false;
        } else if (drill.category !== selectedCategory) {
          return false;
        }
      }
      // Search filter
      if (!drillSearchTerm.trim()) return true;
      const q = drillSearchTerm.toLowerCase();
      return (
        drill.title.toLowerCase().includes(q) ||
        (drill.subtitle && drill.subtitle.toLowerCase().includes(q)) ||
        (drill.objective && drill.objective.toLowerCase().includes(q)) ||
        drill.category.toLowerCase().includes(q) ||
        (drill.categoryLabel && drill.categoryLabel.toLowerCase().includes(q)) ||
        (drill.cues && drill.cues.some((c) => c.toLowerCase().includes(q)))
      );
    });
  }, [drills, selectedCategory, drillSearchTerm]);

  // Handle category change
  const handleSelectCategory = (catId: 'ALL' | DefensivePositionCategory) => {
    setSelectedCategory(catId);
    setIsCustomMode(false);
    if (catId !== 'ALL' && onCategorySelect) {
      onCategorySelect(catId);
    }
    const matching =
      catId === 'ALL'
        ? drills
        : catId === 'OFFENSE'
        ? drills.filter((d) => d.category === 'OFFENSE' || d.category.startsWith('OFF_'))
        : catId === 'DEFENSE'
        ? drills.filter((d) => ['DL', 'DE', 'LB', 'DB', 'SCHEME', 'DEFENSE', 'TEAM', 'TACKLE'].includes(d.category))
        : drills.filter((d) => d.category === catId);
    if (matching.length > 0 && !matching.some((d) => d.id === activeDrillId)) {
      setActiveDrillId(matching[0].id);
      setActivePhaseIdx(0);
      setIsAutoPlaying(false);
      if (matching[0].category && onDrillSelect) {
        onDrillSelect(matching[0].id, matching[0].category);
      }
    }
  };

  // Handle drill change
  const handleSelectDrill = (drillId: string) => {
    setIsCustomMode(false);
    setActiveDrillId(drillId);
    setActivePhaseIdx(0);
    setIsAutoPlaying(false);
    const matched = drills.find((d) => d.id === drillId);
    if (matched?.category && onDrillSelect) {
      onDrillSelect(drillId, matched.category);
    }
  };

  // Toggle whether a drill is selected / deselected to have a whiteboard
  const handleToggleDrillWhiteboard = (drillId: string) => {
    const isNowEnabled = toggleDrillWhiteboard(drillId);
    setDisabledDrillIds(getDisabledWhiteboardDrillIds());
    const matched = drills.find((d) => d.id === drillId);
    showToast(
      isNowEnabled
        ? `Whiteboard enabled for "${matched?.title || 'drill'}"`
        : `Whiteboard deselected for "${matched?.title || 'drill'}"`
    );
  };

  // Step through drills on sideline / mobile
  const handlePrevDrill = () => {
    const currentIdx = drills.findIndex((d) => d.id === activeDrillId);
    if (currentIdx > 0) {
      handleSelectDrill(drills[currentIdx - 1].id);
    } else if (drills.length > 0) {
      handleSelectDrill(drills[drills.length - 1].id);
    }
  };

  const handleNextDrill = () => {
    const currentIdx = drills.findIndex((d) => d.id === activeDrillId);
    if (currentIdx >= 0 && currentIdx < drills.length - 1) {
      handleSelectDrill(drills[currentIdx + 1].id);
    } else if (drills.length > 0) {
      handleSelectDrill(drills[0].id);
    }
  };

  // Save new custom drill
  const handleSaveNewDrill = (newDrill: WhiteboardDrill) => {
    const custom = getCustomWhiteboardDrills();
    saveCustomWhiteboardDrills([...custom, newDrill]);
    refreshDrills();
    setActiveDrillId(newDrill.id);
    setSelectedCategory(newDrill.category);
    setActivePhaseIdx(0);
    setIsCustomMode(false);
    if (newDrill.category && onDrillSelect) {
      onDrillSelect(newDrill.id, newDrill.category);
    }
    showToast(`Drill "${newDrill.title}" saved to library!`);
  };

  // Delete current drill
  const handleDeleteDrill = () => {
    if (!currentDrill) return;
    const drillTitle = currentDrill.title;
    if (!window.confirm(`Are you sure you want to delete "${drillTitle}" from the whiteboard?`)) {
      return;
    }

    // 1. If in custom drills, remove from custom drills
    const custom = getCustomWhiteboardDrills();
    const filteredCustom = custom.filter((d) => d.id !== currentDrill.id);
    saveCustomWhiteboardDrills(filteredCustom);

    // 2. Mark in deleted IDs
    const deletedIds = getDeletedWhiteboardDrillIds();
    if (!deletedIds.includes(currentDrill.id)) {
      saveDeletedWhiteboardDrillIds([...deletedIds, currentDrill.id]);
    }

    // 3. Find next drill to switch to
    const remaining = drills.filter((d) => d.id !== currentDrill.id);
    refreshDrills();

    if (remaining.length > 0) {
      setActiveDrillId(remaining[0].id);
      setSelectedCategory(remaining[0].category);
      setActivePhaseIdx(0);
      if (remaining[0].category && onDrillSelect) {
        onDrillSelect(remaining[0].id, remaining[0].category);
      }
    }
    showToast(`Deleted drill "${drillTitle}".`);
  };

  // Load drill data when switching drill or phase (unless in custom mode)
  useEffect(() => {
    if (isCustomMode) return;
    const drill = drills.find((d) => d.id === activeDrillId) || drills[0];
    if (!drill) return;
    if (drill.phases && drill.phases.length > 0) {
      const phase = drill.phases[activePhaseIdx] || drill.phases[0];
      if (phase) {
        const spread = spreadDiagramElements(phase.tokens, phase.arrows, phase.zones, spreadMode);
        setTokens(spread.tokens);
        setArrows(spread.arrows);
        setZones(spread.zones);
        setTextElements(
          phase.textElements && phase.textElements.length > 0
            ? phase.textElements
            : drill.notes && drill.notes.length > 0
            ? [
                {
                  id: `txt-note-${drill.id}`,
                  text: drill.notes.slice(0, 4).join('\n'),
                  x: 35,
                  y: 350,
                  fontSize: 10.5,
                  color: '#1e293b',
                  fontWeight: '700',
                  align: 'left',
                },
              ]
            : []
        );
        setSelectedId(null);
        setSelectedType(null);
      }
    } else {
      setTokens([]);
      setArrows([]);
      setZones([]);
      setTextElements([]);
      setSelectedId(null);
      setSelectedType(null);
    }
  }, [activeDrillId, activePhaseIdx, isCustomMode, spreadMode, drills]);

  // Diagram Spacing / Spread Mode handler
  const handleSetSpreadMode = (mode: WhiteboardSpreadMode) => {
    setSpreadMode(mode);
    safeJSONSet('footballWhiteboardSpacing', mode);
    if (isCustomMode) {
      const spread = spreadDiagramElements(tokens, arrows, zones, mode);
      setTokens(spread.tokens);
      setArrows(spread.arrows);
      setZones(spread.zones);
    }
    showToast(
      mode === 'wide'
        ? 'Wide Spread spacing (1.4x) applied!'
        : mode === 'spread'
        ? 'Spread spacing (1.25x) applied!'
        : 'Standard spacing applied!'
    );
  };

  // Auto-play loop for drills
  useEffect(() => {
    let timer: any = null;
    if (isAutoPlaying && !isCustomMode) {
      timer = setInterval(() => {
        const drill = drills.find((d) => d.id === activeDrillId) || drills[0];
        if (drill && drill.phases && drill.phases.length > 0) {
          setActivePhaseIdx((prev) => (prev + 1) % drill.phases.length);
        }
      }, 2400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAutoPlaying, activeDrillId, isCustomMode, drills]);

  // Phase Stepping
  const handlePrevPhase = () => {
    if (isCustomMode) return;
    const total = currentDrill.phases.length;
    setActivePhaseIdx((prev) => (prev - 1 + total) % total);
  };

  const handleNextPhase = () => {
    if (isCustomMode) return;
    const total = currentDrill.phases.length;
    setActivePhaseIdx((prev) => (prev + 1) % total);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying((prev) => !prev);
  };

  // Wipe Freehand Canvas
  const handleWipeBoard = () => {
    if (sketchPadRef.current) {
      const ctx = sketchPadRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, sketchPadRef.current.width, sketchPadRef.current.height);
      }
    }
    showToast('Dry erase marker wiped clean!');
  };

  // Clear All Board Elements
  const handleClearAll = () => {
    if (confirm('Clear all X\'s, O\'s, blitz arrows, and coverage zones from the board?')) {
      setTokens([]);
      setArrows([]);
      setZones([]);
      setSelectedId(null);
      setSelectedType(null);
      handleWipeBoard();
      setIsCustomMode(true);
      showToast('Board reset to clean field');
    }
  };

  // Switch to a Preset Scheme
  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_SCHEMES.find((p) => p.id === presetId);
    if (!preset) return;
    setIsCustomMode(true);
    setIsAutoPlaying(false);
    setTokens([...preset.tokens]);
    setArrows([...preset.arrows]);
    setZones([...preset.zones]);
    setCustomTitle(preset.name.toUpperCase());
    setCustomObjective(`Installed ${preset.name} with assigned coverage drops and rush responsibilities.`);
    setSelectedId(null);
    setSelectedType(null);
    showToast(`Loaded ${preset.name}`);
  };

  // Delete selected element
  const handleDeleteSelected = () => {
    if (!selectedId || !selectedType) return;
    if (selectedType === 'token') {
      setTokens(tokens.filter((t) => t.id !== selectedId));
    } else if (selectedType === 'arrow') {
      setArrows(arrows.filter((a) => a.id !== selectedId));
    } else if (selectedType === 'zone') {
      setZones(zones.filter((z) => z.id !== selectedId));
    }
    setSelectedId(null);
    setSelectedType(null);
    showToast('Element deleted');
  };

  // Print Whiteboard - Isolates JUST the current active drill or scheme onto a high-contrast coaching sheet
  const handlePrintWhiteboard = () => {
    if (!isCustomMode && currentDrill) {
      printDrillSheet(currentDrill, activePhaseIdx);
      showToast(`Printing drill sheet for ${currentDrill.title}...`);
      return;
    }

    // In custom mode, construct WhiteboardDrill object
    const customDrill: WhiteboardDrill = {
      id: 'custom-scheme',
      category: 'SCHEME',
      categoryLabel: 'Custom Chalkboard Scheme',
      title: customTitle,
      subtitle: 'Custom Whiteboard Defensive Scheme',
      objective: customObjective,
      equipment: 'Standard field cones & football',
      cues: customCues,
      faults: customFaults,
      phases: [
        {
          name: 'CUSTOM SETUP',
          description: customObjective,
          tokens,
          arrows,
          zones,
        },
      ],
    };
    printDrillSheet(customDrill, 0);
    showToast(`Printing custom sheet for ${customTitle}...`);
  };

  // Save to Playbooks & Guides Binder
  const handleSaveToPlaybook = () => {
    if (!onSaveToGuidePlaybook) {
      showToast('Saved to local whiteboard storage');
      return;
    }
    const folderName = isCustomMode
      ? 'Custom Defensive Whiteboard'
      : currentDrill.category === 'LB'
      ? 'Linebackers (LB) Whiteboard'
      : currentDrill.category === 'DE'
      ? 'Defensive Ends (DE) Whiteboard'
      : currentDrill.category === 'DB'
      ? 'Defensive Backs (DB) Whiteboard'
      : 'D-Line Whiteboard';
    const subTabName = isCustomMode ? customTitle : currentDrill.title;

    // Generate self-contained HTML
    const htmlExport = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${isCustomMode ? customTitle : currentDrill.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Permanent+Marker&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Space Grotesk', sans-serif; background: #1e222a; color: #f8fafc; padding: 16px; margin: 0; }
  .frame { background: #cbd5e1; padding: 12px; border-radius: 12px; max-width: 1000px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .board { background: radial-gradient(circle at 50% 20%, #ffffff 0%, #f4f6f9 85%, #eaecf1 100%); border-radius: 8px; overflow: hidden; }
  .notes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .card { background: white; padding: 12px; border-radius: 6px; font-family: 'Architects Daughter', cursive; color: #1e293b; }
  .card-green { border-left: 5px solid #058538; }
  .card-red { border-left: 5px solid #d91b24; }
  h3 { font-family: 'Permanent Marker', cursive; margin-top: 0; }
</style>
</head>
<body>
<div class="frame">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; color: #0f172a;">
    <h2 style="margin: 0; font-family: 'Permanent Marker', cursive;">${isCustomMode ? customTitle : currentDrill.title}</h2>
    <span style="background: #d91b24; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">10U WHITEBOARD</span>
  </div>
  <div class="board">
    <svg viewBox="0 0 700 500" style="width: 100%; height: auto;">
      <line x1="30" y1="240" x2="670" y2="240" stroke="#0052cc" stroke-width="2.5" />
      <text x="40" y="232" font-family="'Permanent Marker', cursive" font-size="13" fill="#0052cc">LOS (LINE OF SCRIMMAGE)</text>
      ${zones.map((z) => `<ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="${z.color}" fill-opacity="${z.opacity || 0.2}" stroke="${z.color}" stroke-width="2" stroke-dasharray="6,4"/><text x="${z.cx}" y="${z.cy + 4}" font-family="'Permanent Marker', cursive" font-size="12" fill="${z.color}" text-anchor="middle">${z.name}</text>`).join('')}
      ${arrows.map((a) => `<path d="M ${a.startX} ${a.startY} ${a.controlX ? `Q ${a.controlX} ${a.controlY}` : 'L'} ${a.endX} ${a.endY}" fill="none" stroke="${a.color}" stroke-width="3" ${a.dashed ? 'stroke-dasharray="6,4"' : ''}/><text x="${(a.startX + a.endX) / 2 + 6}" y="${(a.startY + a.endY) / 2}" font-family="'Architects Daughter', cursive" font-size="11" fill="${a.color}">${a.label || ''}</text>`).join('')}
      ${tokens.map((t) => `<g transform="translate(${t.x}, ${t.y})"><circle cx="0" cy="0" r="16" fill="${t.type === 'O' ? '#fff' : t.color || '#0052cc'}" stroke="#1a1a24" stroke-width="2.5"/><text x="0" y="5" font-family="'Permanent Marker', cursive" font-size="11" text-anchor="middle" fill="${t.type === 'O' ? '#1a1a24' : '#fff'}">${t.label}</text></g>`).join('')}
    </svg>
  </div>
  <div class="notes">
    <div class="card card-green">
      <h3 style="color: #058538;">10U COACHING CUES</h3>
      <ul>${(isCustomMode ? customCues : currentDrill.cues).map((c) => `<li>${c}</li>`).join('')}</ul>
    </div>
    <div class="card card-red">
      <h3 style="color: #d91b24;">DO NOT DO THIS!</h3>
      <ul>${(isCustomMode ? customFaults : currentDrill.faults).map((f) => `<li>${f}</li>`).join('')}</ul>
    </div>
  </div>
</div>
</body>
</html>`;

    onSaveToGuidePlaybook(folderName, subTabName, htmlExport);
    showToast(`Saved to Playbook Guides under [${folderName} > ${subTabName}]!`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-0 sm:px-4 py-2 sm:py-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header className="w-full max-w-7xl flex flex-wrap justify-between items-center gap-3 mb-3 px-2 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-md">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                10U DEFENSIVE WHITEBOARD{' '}
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-bold">COACH PLAYBOOK</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Interactive Fundamentals, Blitz Tracks & Zone Bubbles for DL, DE, LB, and DB
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrintWhiteboard}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Board</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToPlaybook}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Save to Playbook</span>
          </button>

          {onNavigateToGuide && (
            <button
              type="button"
              onClick={onNavigateToGuide}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-colors"
            >
              Open Playbook Binder
            </button>
          )}
        </div>
      </header>

      {/* Top Segmented Switcher (Drill Library vs Chalkboard Diagrams) */}
      {onNavigateToDrills && (
        <div className="w-full max-w-7xl mb-3 flex items-center justify-between gap-1.5 p-1.5 bg-slate-950/90 border border-slate-800 rounded-2xl shadow-lg print:hidden">
          <button
            type="button"
            onClick={onNavigateToDrills}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <Dumbbell className="w-4 h-4 text-indigo-400" />
            <span>Drill Library ({drills.length})</span>
          </button>
          <button
            type="button"
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white font-black text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            <PenTool className="w-4 h-4" />
            <span>Tactical Chalkboard</span>
          </button>
        </div>
      )}

      {/* Mobile Top Segmented Tab (Position & Drill List vs Full-Width Chalkboard) */}
      <div className="w-full max-w-7xl mb-2.5 px-2 sm:px-0 sm:hidden print:hidden">
        <div className="grid grid-cols-2 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black shadow-xs dark:shadow-lg">
          <button
            type="button"
            onClick={() => setMobileViewMode('list')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileViewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Select Position & Drill</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('drill')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileViewMode === 'drill'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Whiteboard & Notes</span>
          </button>
        </div>
      </div>

      {mobileViewMode === 'list' ? (
        /* =========================================================================
           POSITION & DRILL SELECTION LIST VIEW (SELECT POSITION & DRILL FROM LIST)
           ========================================================================= */
        <section className="w-full max-w-7xl bg-white dark:bg-slate-900 border-x-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl p-3 sm:p-5 shadow-xs dark:shadow-2xl space-y-4">
          {/* Header & Return to Open Drill */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide">
                    Select Position & Drill
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Choose a position group below, then tap any drill to open directly on the whiteboard
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Button to return to currently open drill */}
            <button
              type="button"
              onClick={() => {
                setMobileViewMode('drill');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-indigo-700 dark:text-blue-300 hover:text-indigo-900 dark:hover:text-blue-200 border border-slate-200 dark:border-blue-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Return to Open Drill</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Position Group Selection Chips */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
                Step 1: Choose Position Group
              </span>
              <span className="text-[11px] text-slate-500 font-bold">
                {listFilteredDrills.length} Drills Shown
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectCategory('ALL')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/40'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-950 text-slate-700 hover:text-slate-950 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">🏈</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                  }`}>
                    {drills.length}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-black uppercase">ALL POSITIONS</div>
                  <div className={`text-[10px] ${selectedCategory === 'ALL' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    Entire Playbook
                  </div>
                </div>
              </button>

              {DEFENSIVE_POSITION_GROUPS.map((pos) => {
                const isSelected = selectedCategory === pos.id;
                const count = drills.filter((d) => d.category === pos.id).length;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectCategory(pos.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/40'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-950 text-slate-700 hover:text-slate-950 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-base">{pos.icon}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                      }`}>
                        {count}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase">{pos.shortLabel}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {pos.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Fast Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={drillSearchTerm}
              onChange={(e) => setDrillSearchTerm(e.target.value)}
              placeholder="Search drills by name, coaching cues, or techniques..."
              className="w-full bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />
            {drillSearchTerm && (
              <button
                type="button"
                onClick={() => setDrillSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* 3. Step 2: Drills List */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Step 2: Tap Any Drill to Open ({listFilteredDrills.length})
              </span>
              <span className="text-[11px] text-indigo-600 dark:text-blue-400 font-bold">
                Tap opens full whiteboard & coaching notes
              </span>
            </div>

            {listFilteredDrills.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No drills found matching your selection.</p>
                <button
                  type="button"
                  onClick={() => {
                    setDrillSearchTerm('');
                    setSelectedCategory('ALL');
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {listFilteredDrills.map((drill) => {
                  const isActive = drill.id === activeDrillId && !isCustomMode;
                  const posMeta = DEFENSIVE_POSITION_GROUPS.find((g) => g.id === drill.category);

                  return (
                    <div
                      key={drill.id}
                      onClick={() => {
                        handleSelectDrill(drill.id);
                        setMobileViewMode('drill');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-blue-950/50 border-indigo-400 dark:border-blue-500 ring-2 ring-indigo-400/50 dark:ring-blue-500/50 shadow-md'
                          : 'bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:hover:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-blue-500/50 shadow-xs hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border bg-indigo-50 dark:bg-blue-600/20 text-indigo-700 dark:text-blue-300 border-indigo-200 dark:border-blue-500/30">
                            <span>{posMeta?.icon || '🏈'}</span>
                            <span>{posMeta?.shortLabel || drill.category}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {drill.phases && drill.phases.length > 0 && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-sky-800 dark:text-sky-300 border border-slate-200 dark:border-slate-700">
                                {drill.phases.length} {drill.phases.length === 1 ? 'Phase' : 'Phases'}
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-blue-300 transition-colors">
                          {drill.title}
                        </h3>

                        {drill.subtitle && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {drill.subtitle}
                          </p>
                        )}

                        {drill.cues && drill.cues.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {drill.cues.slice(0, 3).map((cue, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                              >
                                {cue}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-black">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleDrillWhiteboard(drill.id);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-black border flex items-center gap-1 transition-all cursor-pointer ${
                            !disabledDrillIds.includes(drill.id)
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-700'
                          }`}
                          title={!disabledDrillIds.includes(drill.id) ? 'Whiteboard is enabled. Click to deselect.' : 'Whiteboard is deselected. Click to enable.'}
                        >
                          <PenTool className="w-3 h-3" />
                          <span>{!disabledDrillIds.includes(drill.id) ? 'Board ON' : 'No Board'}</span>
                        </button>
                        <div className="flex items-center gap-1 text-indigo-600 dark:text-blue-400 group-hover:text-indigo-700 dark:group-hover:text-blue-300">
                          <span className="text-[11px] font-bold">{isActive ? 'Active' : 'Open'}</span>
                          <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-blue-600/20 text-indigo-700 dark:text-white group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Mobile & Desktop Top Bar with Quick "Select Position & Drill" Button */}
          <div className="w-full max-w-7xl mb-2 sm:mb-2.5 px-2 sm:px-0 print:hidden">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-xs dark:shadow-xl flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileViewMode('list');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                title="Select a position and drill from list"
              >
                <Layers className="w-4 h-4" />
                <span>Select Position & Drill</span>
              </button>

              {/* Active Drill Title & Category summary */}
              <button
                type="button"
                onClick={() => {
                  setMobileViewMode('list');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="min-w-0 flex-1 text-right cursor-pointer group px-1"
                title="Click to change drill"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-blue-400 tracking-wider truncate">
                    {DEFENSIVE_POSITION_GROUPS.find((g) => g.id === currentDrill.category)?.shortLabel || currentDrill.category}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">•</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {drills.findIndex((d) => d.id === activeDrillId) + 1} of {drills.length}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-blue-300 truncate">
                  {isCustomMode ? customTitle : currentDrill.title}
                </p>
              </button>

              {/* Quick Browse Modal button */}
              <button
                type="button"
                onClick={() => setIsDrillPickerModalOpen(true)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer shrink-0"
                title="Browse modal"
              >
                <span>Quick Modal</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Quick Position Category Filter Shortcuts */}
            <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 mt-2 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => handleSelectCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-500 font-black'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950/60 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                ALL ({drills.length})
              </button>
              {DEFENSIVE_POSITION_GROUPS.map((pos) => {
                const isSelected = selectedCategory === pos.id;
                const count = drills.filter((d) => d.category === pos.id).length;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectCategory(pos.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 font-black'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950/60 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>{pos.icon}</span>
                    <span>{pos.shortLabel}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-100 dark:text-blue-200 font-bold' : 'text-slate-500'}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              SECTION 1: COMPACT DRILL HEADER & ACTIONS (FULL WIDTH ON MOBILE)
              ========================================================================= */}
          <section className="w-full max-w-7xl mb-2 sm:mb-3 bg-white dark:bg-slate-900 border-x-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl p-3 sm:p-4 shadow-xs dark:shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Active Drill Identity & Position Group */}
              <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-blue-600/20 text-indigo-700 dark:text-blue-300 rounded-xl border border-indigo-200 dark:border-blue-500/30 text-xl flex items-center justify-center shrink-0">
              {DEFENSIVE_POSITION_GROUPS.find((g) => g.id === currentDrill.category)?.icon || "🏈"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-blue-600/20 text-indigo-700 dark:text-blue-300 border border-indigo-200 dark:border-blue-500/30">
                  {DEFENSIVE_POSITION_GROUPS.find((g) => g.id === currentDrill.category)?.label || currentDrill.categoryLabel || currentDrill.category}
                </span>
                {!isCustomMode && (!currentDrill.phases || currentDrill.phases.length === 0) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    Description & Technique Guide
                  </span>
                )}
                {isCustomMode && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    Custom Drawing Canvas
                  </span>
                )}
              </div>
              <h2
                className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-wide uppercase mt-0.5"
                style={{ fontFamily: "'Permanent Marker', cursive" }}
              >
                {isCustomMode ? customTitle : currentDrill.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isCustomMode ? customObjective : currentDrill.subtitle || currentDrill.objective}
              </p>
            </div>
          </div>

          {/* Right: Phase Controls & Drill Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Phase Stepper (Only shown when drill has multiple phases) */}
            {!isCustomMode && currentDrill.phases && currentDrill.phases.length > 1 && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={handlePrevPhase}
                  className="px-2 py-1 text-slate-700 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Previous Phase"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-2 py-0.5 text-center">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-blue-400 block leading-tight">
                    Phase {activePhaseIdx + 1} of {currentDrill.phases.length}
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[160px] block">
                    {currentDrill.phases[activePhaseIdx]?.name?.replace(/PHASE \d+:\s*/i, "") || `Phase ${activePhaseIdx + 1}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNextPhase}
                  className="px-2 py-1 text-slate-700 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Next Phase"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    isAutoPlaying
                      ? "bg-amber-600 text-white"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                  title={isAutoPlaying ? "Pause Animation" : "Auto-Play Phases"}
                >
                  {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isAutoPlaying ? "Pause" : "Play"}</span>
                </button>
              </div>
            )}

            {/* Chalkboard Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isCustomMode
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
              title="Toggle between preset diagram and blank chalkboard canvas"
            >
              <PenTool className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
              <span>{isCustomMode ? "Viewing Chalkboard" : "Open Chalkboard"}</span>
            </button>

            {/* Whiteboard Diagram Availability Toggle */}
            {!isCustomMode && (
              <button
                type="button"
                onClick={() => handleToggleDrillWhiteboard(currentDrill.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                  !disabledDrillIds.includes(currentDrill.id)
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/60 hover:bg-rose-100 shadow-xs'
                }`}
                title={
                  !disabledDrillIds.includes(currentDrill.id)
                    ? 'Whiteboard diagram is enabled for this drill. Click to deselect.'
                    : 'Whiteboard diagram is deselected for this drill. Click to enable.'
                }
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Whiteboard: {!disabledDrillIds.includes(currentDrill.id) ? 'Active' : 'Deselected'}</span>
              </button>
            )}

            {/* Add Drill Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              title="Create a new drill for this category"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Drill</span>
            </button>

            {/* Delete Drill Button */}
            {!isCustomMode && (
              <button
                type="button"
                onClick={handleDeleteDrill}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/60 text-slate-700 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-200 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-600/50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="Delete this drill from the whiteboard"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span className="hidden sm:inline">Delete Drill</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 & 3: WHITEBOARD CANVAS OR DESCRIPTION VIEW
          ========================================================================= */}
      {!isCustomMode && (!currentDrill.phases || currentDrill.phases.length === 0) ? (
        <WhiteboardDrillDescriptionView
          drill={currentDrill}
          onOpenChalkboard={() => setIsCustomMode(true)}
          onPrintDrill={handlePrintWhiteboard}
          onNavigateToPracticePlan={
            onNavigateToPracticePlan
              ? () => onNavigateToPracticePlan(matchingPracticePlanInfo?.plan.id, currentDrill.title)
              : undefined
          }
          practicePlanInfo={
            matchingPracticePlanInfo
              ? {
                  planTitle: matchingPracticePlanInfo.plan.title,
                  periodNumber: matchingPracticePlanInfo.periodNumber,
                  stationName: matchingPracticePlanInfo.stationName,
                }
              : null
          }
        />
      ) : (
        <>
          {/* =========================================================================
          SECTION 2: FULL-WIDTH WHITEBOARD CANVAS & TOOLBAR
          ========================================================================= */}
          {!isCustomMode && disabledDrillIds.includes(currentDrill.id) ? (
            <div className="w-full max-w-7xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xs flex flex-col items-center justify-center text-center my-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-3">
                <PenTool className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                Whiteboard Deselected for This Drill
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mb-5 leading-relaxed">
                You have deselected the interactive diagram for <strong className="text-slate-900 dark:text-slate-200">"{currentDrill.title}"</strong>. The complete coaching keys, setup cues, and step-by-step instructions are available below.
              </p>
              <div className="flex items-center gap-2.5 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => handleToggleDrillWhiteboard(currentDrill.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Re-Enable Whiteboard Diagram</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintWhiteboard}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Drill Sheet</span>
                </button>
              </div>
            </div>
          ) : !isCustomMode ? (
            <TriangleDrillWhiteboard
              drill={currentDrill}
              activePhaseIdx={activePhaseIdx}
              onPhaseChange={setActivePhaseIdx}
              onOpenCustomChalkboard={() => setIsCustomMode(true)}
              onPrint={handlePrintWhiteboard}
            />
          ) : (
            <div className="w-full max-w-7xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md dark:shadow-2xl p-2.5 sm:p-5 flex flex-col relative">
        {/* Canvas Quick Controls Bar (Declutter, Labels, Coaching Inset, Print) */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3 px-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-2 bg-slate-100 dark:bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              Tactical Chalkboard
            </span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 hidden md:inline">
              High-contrast alignment & routes
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Zone Shade Dimmer Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/90 rounded-xl p-1 border border-slate-200 dark:border-slate-800 shadow-inner">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
                <SunMedium className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                Shade:
              </span>
              <button
                type="button"
                onClick={() => setZoneShadeMode('dim')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoneShadeMode === 'dim'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
                title="Dim shade: soft translucent wash (Default per coach preference)"
              >
                Dim
              </button>
              <button
                type="button"
                onClick={() => setZoneShadeMode('soft')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoneShadeMode === 'soft'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
                title="Soft shade: subtle tint"
              >
                Soft
              </button>
              <button
                type="button"
                onClick={() => setZoneShadeMode('outline')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoneShadeMode === 'outline'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
                title="Outline only: dashed boundary without fill tint"
              >
                Outline
              </button>
            </div>

            {/* Toggle Labels */}
            <button
              type="button"
              onClick={() => setShowLabels(!showLabels)}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                showLabels
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-sky-700 dark:text-sky-300 border-slate-200 dark:border-slate-700'
                  : 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
              }`}
              title={showLabels ? 'Hide arrow and zone labels for clean uncluttered view' : 'Show all diagram labels'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Labels: {showLabels ? 'Visible' : 'Decluttered'}</span>
            </button>

            {/* Toggle Coaching Keys Card */}
            {currentDrill.diagramKeys && currentDrill.diagramKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCoachingInset(!showCoachingInset)}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  showCoachingInset
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title="Toggle the coaching keys inset card overlay on the whiteboard"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" />
                <span>Keys: {showCoachingInset ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {/* Quick Print Button */}
            {!isCustomMode && (
              <div className="flex items-center gap-1.5">
                {onNavigateToPracticePlan && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPracticePlan(matchingPracticePlanInfo?.plan.id, currentDrill.title)}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-500/40 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    title={
                      matchingPracticePlanInfo
                        ? `Open in ${matchingPracticePlanInfo.plan.title} (Period ${matchingPracticePlanInfo.periodNumber})`
                        : 'Open in Practice Plan'
                    }
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {matchingPracticePlanInfo
                        ? `Plan (P${matchingPracticePlanInfo.periodNumber})`
                        : 'Plan'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHudlModalOpen(true)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl border border-indigo-500 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Upload playbook PDF or text from Hudl to auto-redraw"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload from Hudl</span>
                </button>
                <button
                  type="button"
                  onClick={() => printDrillSheet(currentDrill, activePhaseIdx)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Print this isolated drill sheet"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
                  <span>Print Drill</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Full-Width Canvas Container */}
        <div className="w-full bg-white rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-md dark:shadow-2xl relative min-h-[580px] sm:min-h-[660px] xl:min-h-[720px]">
          <WhiteboardCanvas
            tokens={tokens}
            arrows={arrows}
            zones={zones}
            textElements={textElements}
            isDrawingMode={isDrawingMode}
            penColor={penColor}
            penWidth={penWidth}
            stampMode={stampMode}
            stampLabel={stampLabel}
            stampColor={stampColor}
            stampFillMode={stampFillMode}
            stampZoneShape={stampZoneShape}
            onUpdateTokens={setTokens}
            onUpdateArrows={setArrows}
            onUpdateZones={setZones}
            onUpdateTextElements={setTextElements}
            onSelectElement={(type, id) => {
              setSelectedType(type);
              setSelectedId(id);
            }}
            selectedId={selectedId}
            selectedType={selectedType}
            sketchPadRef={sketchPadRef}
            diagramKeys={currentDrill.diagramKeys}
            showCoachingInset={showCoachingInset}
            showLabels={showLabels}
            zoneShadeMode={zoneShadeMode}
          />
        </div>

        {/* Whiteboard Lower Toolbar */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm dark:shadow-xl flex flex-wrap justify-between items-center gap-3">
          {/* Left: Phase controls for Drills */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isCustomMode ? (
              <>
                <button
                  type="button"
                  onClick={handlePrevPhase}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs transition-all active:translate-y-0.5 cursor-pointer"
                >
                  ◀ Prev Phase
                </button>
                <div className="px-3.5 py-1.5 bg-indigo-50 dark:bg-blue-950/80 text-indigo-700 dark:text-sky-300 text-xs font-mono font-black rounded-lg border border-indigo-200 dark:border-blue-800/60 shadow-inner">
                  {currentDrill.phases[activePhaseIdx]?.name || 'PHASE 1'}
                </div>
                <button
                  type="button"
                  onClick={handleNextPhase}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs transition-all active:translate-y-0.5 cursor-pointer"
                >
                  Next Phase ▶
                </button>
                <button
                  type="button"
                  onClick={toggleAutoPlay}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    isAutoPlaying
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                  }`}
                >
                  {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isAutoPlaying ? 'Pause Loop' : 'Play Loop'}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg uppercase">
                  Chalkboard Free Playmaker
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg border border-rose-700 cursor-pointer"
                >
                  Clear Field
                </button>
              </div>
            )}
          </div>

          {/* Center: Comprehensive Stamp Controls for Shapes, Text, Fill, Colors, & Circle Zones */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
            {/* Shape Selectors */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 px-1">Shapes:</span>

              {/* Circle (O) */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'O' ? 'none' : 'O');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'O'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp Circle Token"
              >
                <Circle className="w-3.5 h-3.5" />
                <span className="text-[11px]">Circle</span>
              </button>

              {/* Square */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'square' ? 'none' : 'square');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'square'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp Square Token (e.g. Center / Lineman)"
              >
                <Square className="w-3.5 h-3.5" />
                <span className="text-[11px]">Square</span>
              </button>

              {/* Triangle */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'triangle' ? 'none' : 'triangle');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'triangle'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp Triangle Token (e.g. Safety / Edge)"
              >
                <Triangle className="w-3.5 h-3.5" />
                <span className="text-[11px]">Triangle</span>
              </button>

              {/* Diamond */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'diamond' ? 'none' : 'diamond');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'diamond'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp Diamond Token (e.g. Hybrid / H-Back / Star)"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="text-[11px]">Diamond</span>
              </button>

              {/* Star */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'star' ? 'none' : 'star');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'star'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp Star Token (e.g. Impact Player / Key Defender)"
              >
                <Star className="w-3.5 h-3.5" />
                <span className="text-[11px]">Star</span>
              </button>

              {/* X Token */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'X' ? 'none' : 'X');
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'X'
                    ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="Stamp X Token (Defense)"
              >
                <CloseIcon className="w-3.5 h-3.5" />
                <span className="text-[11px]">X</span>
              </button>
            </div>

            {/* Fill Mode Toggle: Fill vs No Fill */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 px-1">Style:</span>
              <button
                type="button"
                onClick={() => setStampFillMode('fill')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                  stampFillMode === 'fill' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="Solid Fill"
              >
                Fill
              </button>
              <button
                type="button"
                onClick={() => setStampFillMode('nofill')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                  stampFillMode === 'nofill' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="No Fill (Crisp Outline only)"
              >
                No Fill
              </button>
            </div>

            {/* Color Swatches for Shapes & Zones */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 px-1">Color:</span>
              {[
                { color: '#1d4ed8', title: 'Royal Blue' },
                { color: '#dc2626', title: 'Crimson Red' },
                { color: '#16a34a', title: 'Emerald Green' },
                { color: '#d97706', title: 'Gold Amber' },
                { color: '#7c3aed', title: 'Purple' },
                { color: '#ea580c', title: 'Orange' },
                { color: '#0f172a', title: 'Slate Black' },
                { color: '#ffffff', title: 'White' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setStampColor(c.color)}
                  title={c.title}
                  className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                    stampColor === c.color ? 'scale-125 border-white ring-2 ring-indigo-500' : 'border-slate-400 dark:border-slate-600 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
              <input
                type="color"
                value={stampColor}
                onChange={(e) => setStampColor(e.target.value)}
                title="Custom Color"
                className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>

            {/* Label Input for Placed Shape */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1.5">Text/Pos:</span>
              <input
                type="text"
                value={stampLabel}
                onChange={(e) => setStampLabel(e.target.value)}
                placeholder="Label"
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 w-16 focus:w-20 transition-all outline-none"
              />
              <select
                value={stampLabel}
                onChange={(e) => setStampLabel(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-bold px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 ml-1 cursor-pointer"
              >
                <optgroup label="Offense">
                  {['C', 'QB', 'RB', 'FB', 'TE', 'WR', 'LT', 'LG', 'RG', 'RT', 'X', 'Z', 'Y'].map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Defense">
                  {['DE', 'DT', 'NT', 'MLB', 'OLB', 'CB', 'FS', 'SS', 'M', 'W', 'S', 'R', 'E'].map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Tactical Zones & Movable Text */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              {/* Circle Zone */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'circle_zone' ? 'none' : 'circle_zone');
                  setStampZoneShape('circle');
                }}
                className={`p-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'circle_zone'
                    ? 'bg-sky-600 text-white ring-2 ring-sky-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300'
                }`}
                title="Stamp Circular Zone Bubble"
              >
                <Target className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
                <span className="text-[11px]">Circle Zone</span>
              </button>

              {/* Oval Zone */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'zone' ? 'none' : 'zone');
                  setStampZoneShape('ellipse');
                }}
                className={`p-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'zone'
                    ? 'bg-sky-600 text-white ring-2 ring-sky-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300'
                }`}
                title="Stamp Oval Zone Bubble"
              >
                <Shield className="w-3.5 h-3.5 text-sky-600 dark:text-sky-300" />
                <span className="text-[11px]">Oval Zone</span>
              </button>

              {/* Blitz Arrow */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'blitz' ? 'none' : 'blitz');
                }}
                className={`p-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'blitz'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-300'
                }`}
                title="Stamp Blitz Arrow"
              >
                <span className="text-sm">⚡</span>
                <span className="text-[11px]">Blitz</span>
              </button>

              {/* Movable Text Note */}
              <button
                type="button"
                onClick={() => {
                  setIsDrawingMode(false);
                  setStampMode(stampMode === 'text' ? 'none' : 'text');
                }}
                className={`p-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  stampMode === 'text'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300'
                }`}
                title="Stamp Coaching Text Note on Canvas"
              >
                <Type className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                <span className="text-[11px]">Text</span>
              </button>
            </div>
          </div>

          {/* Right: Dry-Erase Markers Tray */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mr-1">Dry Erase:</span>
            {[
              { color: '#1a1a24', label: 'Black' },
              { color: '#0052cc', label: 'Blue' },
              { color: '#d91b24', label: 'Red' },
              { color: '#058538', label: 'Green' },
              { color: '#e06c00', label: 'Orange' },
            ].map((pen) => (
              <button
                key={pen.color}
                type="button"
                onClick={() => {
                  setPenColor(pen.color);
                  setIsDrawingMode(true);
                  setStampMode('none');
                }}
                className={`w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-600 shadow transition-transform cursor-pointer ${
                  penColor === pen.color && isDrawingMode ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: pen.color }}
                title={`${pen.label} Marker`}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                setIsDrawingMode(!isDrawingMode);
                if (!isDrawingMode) setStampMode('none');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                isDrawingMode
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {isDrawingMode ? '✏️ Drawing ON' : '✏️ Draw'}
            </button>

            <button
              type="button"
              onClick={handleWipeBoard}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Wipe Board
            </button>
          </div>
        </div>
      </div>
          )}

      {/* =========================================================================
          SECTION 3: PLAY NOTES & COACHING NOTEPAD (BELOW THE DIAGRAM)
          ========================================================================= */}
      <section className="w-full max-w-7xl mt-2 sm:mt-4 bg-white dark:bg-slate-900/95 border-x-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl p-3 sm:p-6 shadow-md dark:shadow-2xl space-y-4">
        {/* Play Notes Header & Active Scheme Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-indigo-600 dark:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Defensive Playbook Notes:</span>
              </span>
              {!isCustomMode ? (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-blue-600/20 text-indigo-700 dark:text-blue-300 border border-indigo-200 dark:border-blue-500/40 uppercase">
                  {currentDrill.category} • {currentDrill.categoryLabel}
                </span>
              ) : (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-600/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 uppercase">
                  Custom Scheme Mode
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <h3
                className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-wide"
                style={{ fontFamily: "'Permanent Marker', cursive" }}
              >
                {isCustomMode ? customTitle : currentDrill.title}
              </h3>
              {isCustomMode && (
                <button
                  type="button"
                  onClick={() => {
                    const newTitle = prompt('Enter Play / Scheme Title:', customTitle);
                    if (newTitle) setCustomTitle(newTitle.toUpperCase());
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Edit Title"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isCustomMode
                ? customObjective
                : `${currentDrill.subtitle} — ${currentDrill.phases[activePhaseIdx]?.name || 'Phase 1'}`}
            </p>
          </div>

          {/* Phase Quick Indicator & Print Action */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isCustomMode && currentDrill.phases.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 px-2">Phases:</span>
                {currentDrill.phases.map((ph, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhaseIdx(idx)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activePhaseIdx === idx
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {onNavigateToPracticePlan && (
              <button
                type="button"
                onClick={() => onNavigateToPracticePlan(matchingPracticePlanInfo?.plan.id, currentDrill.title)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title={
                  matchingPracticePlanInfo
                    ? `Open in ${matchingPracticePlanInfo.plan.title} (Period ${matchingPracticePlanInfo.periodNumber})`
                    : 'Open in Practice Plan'
                }
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {matchingPracticePlanInfo
                    ? `View in Plan (P${matchingPracticePlanInfo.periodNumber})`
                    : 'Open in Plan'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintWhiteboard}
              title="Print isolated 1-page coaching sheet with field setup and cues"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-blue-300 hover:text-indigo-900 dark:hover:text-white text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
              <span>Print Drill Sheet</span>
            </button>
          </div>
        </div>

        {/* Selected Element Inspector (Appears when coach clicks a token, arrow, or zone on the canvas) */}
        {selectedId && selectedType && (
          <div className="bg-amber-500/10 border border-amber-400 dark:border-amber-500/30 rounded-2xl p-3.5 shadow-md animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Selected On Diagram: {selectedType.toUpperCase()} #{selectedId}</span>
              </span>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-1 text-xs font-bold border border-rose-300 dark:border-rose-700/60 transition-colors cursor-pointer"
                title="Delete Element from Diagram"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Element</span>
              </button>
            </div>

            {selectedType === 'token' && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Position Label:</label>
                  <input
                    type="text"
                    value={tokens.find((t) => t.id === selectedId)?.label || ''}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setTokens(tokens.map((t) => (t.id === selectedId ? { ...t, label: val } : t)));
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold w-20 text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Color:</label>
                  <div className="flex items-center gap-1.5">
                    {['#1a1a24', '#0052cc', '#d91b24', '#058538', '#e06c00', '#7c3aed'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setTokens(tokens.map((t) => (t.id === selectedId ? { ...t, color: c } : t)));
                        }}
                        className="w-5 h-5 rounded-full border border-white/60 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedType === 'arrow' && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Route / Blitz Label:</label>
                  <input
                    type="text"
                    value={arrows.find((a) => a.id === selectedId)?.label || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setArrows(arrows.map((a) => (a.id === selectedId ? { ...a, label: val } : a)));
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold w-40 text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Color:</label>
                  <div className="flex items-center gap-1.5">
                    {['#d91b24', '#0052cc', '#058538', '#e06c00', '#1a1a24'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setArrows(arrows.map((a) => (a.id === selectedId ? { ...a, color: c } : a)));
                        }}
                        className="w-5 h-5 rounded-full border border-white/60 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedType === 'zone' && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Coverage Zone Name:</label>
                  <input
                    type="text"
                    value={zones.find((z) => z.id === selectedId)?.name || ''}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setZones(zones.map((z) => (z.id === selectedId ? { ...z, name: val } : z)));
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold w-44 text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">Color:</label>
                  <div className="flex items-center gap-1.5">
                    {['#0284c7', '#058538', '#d91b24', '#e06c00', '#7c3aed'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setZones(zones.map((z) => (z.id === selectedId ? { ...z, color: c } : z)));
                        }}
                        className="w-5 h-5 rounded-full border border-white/60 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drill Setup & Execution Instructions (When available on active drill) */}
        {!isCustomMode && (currentDrill.setup || (currentDrill.instructions && currentDrill.instructions.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {currentDrill.setup && (
              <div
                className={`${
                  currentDrill.instructions && currentDrill.instructions.length > 0
                    ? 'lg:col-span-5'
                    : 'lg:col-span-12'
                } bg-white dark:bg-slate-800/90 p-4 rounded-2xl border-l-4 border-indigo-600 shadow-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <Flag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Field Setup & Alignment</span>
                  </span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">
                  {currentDrill.setup}
                </p>
                {currentDrill.equipment && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                    <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px] shrink-0">Equipment:</span>
                    <span>{currentDrill.equipment}</span>
                  </div>
                )}
              </div>
            )}

            {currentDrill.instructions && currentDrill.instructions.length > 0 && (
              <div
                className={`${
                  currentDrill.setup ? 'lg:col-span-7' : 'lg:col-span-12'
                } bg-white dark:bg-slate-800/90 p-4 rounded-2xl border-l-4 border-amber-600 shadow-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Step-by-Step Execution Instructions</span>
                  </span>
                </div>
                <ol className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {currentDrill.instructions.map((inst, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-black text-xs shrink-0 mt-0.5 shadow-xs">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{inst}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* 3-Column / Responsive Grid of Dry-Erase Coaching Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD 1: Objective & Scheme Technical Progression */}
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border-l-4 border-indigo-600 shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-between text-slate-800 dark:text-slate-100">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Objective & Scheme Breakdown</span>
                </span>
                {isCustomMode && (
                  <button
                    type="button"
                    onClick={() => {
                      const newObj = prompt('Enter Scheme Objective & Notes:', customObjective);
                      if (newObj) setCustomObjective(newObj);
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              <p
                className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3"
                style={{ fontFamily: "'Architects Daughter', cursive" }}
              >
                {isCustomMode ? customObjective : currentDrill.objective}
              </p>

              {/* Active Phase Description (if preset drill) */}
              {!isCustomMode && currentDrill.phases[activePhaseIdx] && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3 mt-2">
                  <div className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-1">
                    Current Phase Focus: {currentDrill.phases[activePhaseIdx].name}
                  </div>
                  <p
                    className="text-xs text-slate-700 dark:text-slate-300 leading-normal"
                    style={{ fontFamily: "'Architects Daughter', cursive" }}
                  >
                    {currentDrill.phases[activePhaseIdx].description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: 10U Practice Coaching Cues & Verbal Triggers */}
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border-l-4 border-emerald-600 shadow-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>10U Practice Coaching Cues</span>
              </span>
              {isCustomMode && (
                <button
                  type="button"
                  onClick={() => {
                    const cue = prompt('Add Coaching Cue:');
                    if (cue) setCustomCues([...customCues, cue]);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Cue</span>
                </button>
              )}
            </div>

            <ul
              className="space-y-2 text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
              style={{ fontFamily: "'Architects Daughter', cursive" }}
            >
              {(isCustomMode ? customCues : currentDrill.cues).map((cue, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-base leading-none mt-0.5">✔</span>
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CARD 3: Critical Mistakes & Penalties (DO NOT DO THIS!) */}
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-2xl border-l-4 border-rose-600 shadow-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>DO NOT DO THIS! (CRITICAL FAULTS)</span>
              </span>
              {isCustomMode && (
                <button
                  type="button"
                  onClick={() => {
                    const fault = prompt('Add Critical Fault:');
                    if (fault) setCustomFaults([...customFaults, fault]);
                  }}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Fault</span>
                </button>
              )}
            </div>

            <ul
              className="space-y-2 text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
              style={{ fontFamily: "'Architects Daughter', cursive" }}
            >
              {(isCustomMode ? customFaults : currentDrill.faults).map((fault, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-black text-base leading-none mt-0.5">✖</span>
                  <span>{fault}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick-Load Defensive Fronts & Coverage Shells */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
              <span>Load Defensive Front / Shell:</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_SCHEMES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset.id)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </section>
        </>
      )}
        </>
      )}

      {/* Add Whiteboard Drill Modal */}
      <AddWhiteboardDrillModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaveDrill={handleSaveNewDrill}
        defaultCategory={currentDrill.category}
        currentBoardTokens={tokens}
        currentBoardArrows={arrows}
        currentBoardZones={zones}
      />

      {/* Mobile & Tactical Whiteboard Drill Picker Modal */}
      <WhiteboardDrillPickerModal
        isOpen={isDrillPickerModalOpen}
        onClose={() => setIsDrillPickerModalOpen(false)}
        drills={drills}
        activeDrillId={activeDrillId}
        onSelectDrill={(drillId) => {
          handleSelectDrill(drillId);
        }}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          handleSelectCategory(cat);
        }}
        onNavigateToDrills={onNavigateToDrills}
        disabledDrillIds={disabledDrillIds}
        onToggleDrillWhiteboard={handleToggleDrillWhiteboard}
      />
      {/* Hudl Playbook Upload & Auto-Redraw Modal */}
      <HudlPlaybookUploadModal
        isOpen={isHudlModalOpen}
        onClose={() => setIsHudlModalOpen(false)}
        onImportPlays={handleHudlImport}
        existingFolders={['SCHEME', 'DL', 'DE', 'LB', 'DB', 'TEAM', 'CUSTOM']}
      />
    </div>
  );
};
