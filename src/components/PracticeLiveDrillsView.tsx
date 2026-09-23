import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Swords,
  Scale,
  Plus,
  Trash2,
  Copy,
  Printer,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Shield,
  Zap,
  Users,
  Flame,
  LayoutGrid,
  Columns,
  Search,
  UserPlus,
  Palette,
  Sliders,
  SlidersHorizontal,
  Smartphone,
  Table as TableIcon,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  FileSpreadsheet,
  Settings2,
  Layers,
} from 'lucide-react';
import {
  LiveDrillGroup,
  LiveDrillFormat,
  LiveDrillPosition,
  PlacedPlayer,
  RosterPlayer,
  UserRole,
  FormationBoard,
  Team,
} from '../types';
import {
  TEAM_COLOR_OPTIONS,
  getTeamColorConfig,
  COLOR_MATCHUP_PRESETS,
  DEFAULT_OFFENSE_LABELS,
  DEFAULT_DEFENSE_LABELS,
  SUGGESTED_OFFENSE_TAGS,
  SUGGESTED_DEFENSE_TAGS,
  generateDefaultPositions,
  createInitialPracticeDrillGroups,
  executeIntelligentAutoFill,
  AutoFillSummary,
  getPlayerLinedUpUnit,
  bothSideJerseysByTeam,
  normalizeJerseyNum,
  drillSpotLastName,
  isFilledPlayer,
  captureLiveDrillSlotLayout,
  applyLayoutToDrillGroup,
  drillGroupsStamp,
  bootstrapLiveDrillSlotLayout,
  getDrillTeamCount,
  drillTeamNumbers,
} from './practiceDrillsUtils';

const FOOTBALL_PLAYER_DRAG = 'application/x-football-player';

function parseDraggedPlacedPlayer(e: React.DragEvent): PlacedPlayer | null {
  const typed = e.dataTransfer.getData(FOOTBALL_PLAYER_DRAG);
  if (typed) {
    try {
      const parsed = JSON.parse(typed);
      if (parsed?.num && parsed.num !== '?') {
        return { num: String(parsed.num), name: drillSpotLastName({ num: parsed.num, name: parsed.name }) };
      }
    } catch {
      // fall through
    }
  }
  return null;
}

interface PracticeLiveDrillsViewProps {
  currentWeek: string;
  practiceDrillGroups: LiveDrillGroup[];
  onUpdatePracticeDrillGroups: (groups: LiveDrillGroup[]) => void;
  roster: RosterPlayer[];
  userRole: UserRole;
  depthChart?: Record<string, PlacedPlayer[]>;
  scrimmageChart?: Record<string, PlacedPlayer[]>;
  formations?: FormationBoard[];
  activeTeam?: Team;
  onDragStartPlacedPlayer?: (
    e: React.DragEvent,
    posId: string,
    idx: number,
    player: PlacedPlayer
  ) => void;
}

export const PracticeLiveDrillsView: React.FC<PracticeLiveDrillsViewProps> = ({
  currentWeek,
  practiceDrillGroups,
  onUpdatePracticeDrillGroups,
  roster,
  userRole,
  depthChart = {},
  scrimmageChart = {},
  formations = [],
  activeTeam,
  onDragStartPlacedPlayer,
}) => {
  // Ensure we have at least one drill group and initialize if empty
  const [localGroups, setLocalGroups] = useState<LiveDrillGroup[]>(() => {
    const source =
      Array.isArray(practiceDrillGroups) && practiceDrillGroups.length > 0
        ? practiceDrillGroups
        : createInitialPracticeDrillGroups();
    source.forEach((g) => bootstrapLiveDrillSlotLayout(g));
    return source.map((g) => applyLayoutToDrillGroup(g));
  });

  const weekRef = useRef(currentWeek);
  const groupsRef = useRef(localGroups);
  groupsRef.current = localGroups;
  useEffect(() => {
    if (weekRef.current !== currentWeek) {
      weekRef.current = currentWeek;
      const source =
        Array.isArray(practiceDrillGroups) && practiceDrillGroups.length > 0
          ? practiceDrillGroups
          : createInitialPracticeDrillGroups();
      source.forEach((g) => bootstrapLiveDrillSlotLayout(g));
      setLocalGroups(source.map((g) => applyLayoutToDrillGroup(g)));
      return;
    }
    if (!Array.isArray(practiceDrillGroups) || practiceDrillGroups.length === 0) return;
    setLocalGroups((prev) => {
      if (drillGroupsStamp(prev) > drillGroupsStamp(practiceDrillGroups)) return prev;
      return practiceDrillGroups.map((g) => applyLayoutToDrillGroup(g));
    });
  }, [currentWeek, practiceDrillGroups]);

  const groups = localGroups;

  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    return groups[0]?.id || '';
  });

  // Keep active group valid
  const currentGroup = useMemo(() => {
    return groups.find((g) => g.id === activeGroupId) || groups[0] || createInitialPracticeDrillGroups()[0];
  }, [groups, activeGroupId]);

  const bothSideByTeam = useMemo(() => bothSideJerseysByTeam(currentGroup), [currentGroup]);

  // Active Matchup selection: 1 (1s vs 1s), 2 (2s vs 2s), 3 (3s vs 3s), '1v2' (Team 1 vs Team 2), '2v1' (Team 2 vs Team 1), or 'all'
  const [activeMatchup, setActiveMatchup] = useState<1 | 2 | 3 | '1v2' | '2v1' | 'all'>('all');
  const [activeOffenseString, setActiveOffenseString] = useState<1 | 2 | 3>(1);
  const [activeDefenseString, setActiveDefenseString] = useState<1 | 2 | 3>(1);

  // Active Team being customized in the customization panel: 1 | 2 | 3
  const [customizingTeamOffense, setCustomizingTeamOffense] = useState<1 | 2 | 3>(1);
  const [customizingTeamDefense, setCustomizingTeamDefense] = useState<1 | 2 | 3>(1);

  // Lookup map of players to their depth chart tier (1 = Black, 2 = Gold, 3 = Blue)
  const playerDepthMap = useMemo(() => {
    const map = new Map<string, { depthString: number; unit: 'offense' | 'defense'; posName: string }>();
    for (const form of formations) {
      const formUnit: 'offense' | 'defense' = (form.unit === 'defense' || form.id.includes('def')) ? 'defense' : 'offense';
      for (const row of form.rows || []) {
        for (const p of row.positions || []) {
          if (!p) continue;
          const players = depthChart[p.id] || [];
          players.forEach((pl, idx) => {
            if (pl && pl.num && pl.num !== '?' && !map.has(`${pl.num}_${formUnit}`)) {
              map.set(`${pl.num}_${formUnit}`, {
                depthString: idx + 1,
                unit: formUnit,
                posName: p.name,
              });
            }
          });
        }
      }
    }
    return map;
  }, [formations, depthChart]);

  // Real-time talent composition for current active Offense & Defense on the field
  const activeOffenseStats = useMemo(() => {
    if (!currentGroup) return { starters: 0, backups: 0, third: 0, total: 0 };
    let starters = 0;
    let backups = 0;
    let third = 0;
    let total = 0;
    const slotIdx = activeOffenseString - 1;

    for (const pos of currentGroup.offensePositions) {
      const assigned = (currentGroup.lineup[pos.id] || [])[slotIdx];
      if (assigned && assigned.num && assigned.num !== '?') {
        total++;
        const info = playerDepthMap.get(`${assigned.num}_offense`);
        const depth = info ? info.depthString : 0;
        if (depth === 1) starters++;
        else if (depth === 2) backups++;
        else if (depth >= 3) third++;
      }
    }
    return { starters, backups, third, total };
  }, [currentGroup, activeOffenseString, playerDepthMap]);

  const activeDefenseStats = useMemo(() => {
    if (!currentGroup) return { starters: 0, backups: 0, third: 0, total: 0 };
    let starters = 0;
    let backups = 0;
    let third = 0;
    let total = 0;
    const slotIdx = activeDefenseString - 1;

    for (const pos of currentGroup.defensePositions) {
      const assigned = (currentGroup.lineup[pos.id] || [])[slotIdx];
      if (assigned && assigned.num && assigned.num !== '?') {
        total++;
        const info = playerDepthMap.get(`${assigned.num}_defense`);
        const depth = info ? info.depthString : 0;
        if (depth === 1) starters++;
        else if (depth === 2) backups++;
        else if (depth >= 3) third++;
      }
    }
    return { starters, backups, third, total };
  }, [currentGroup, activeDefenseString, playerDepthMap]);

  // Matchup selection handlers
  const handleSelectMatchup = (m: 1 | 2 | 3 | '1v2' | '2v1' | 'all') => {
    setActiveMatchup(m);
    if (m === 1) {
      setActiveOffenseString(1);
      setActiveDefenseString(1);
    } else if (m === 2) {
      setActiveOffenseString(2);
      setActiveDefenseString(2);
    } else if (m === 3) {
      setActiveOffenseString(3);
      setActiveDefenseString(3);
    } else if (m === '1v2') {
      setActiveOffenseString(1);
      setActiveDefenseString(2);
    } else if (m === '2v1') {
      setActiveOffenseString(2);
      setActiveDefenseString(1);
    }
  };

  const handleSetOffenseString = (num: 1 | 2 | 3) => {
    setActiveOffenseString(num);
    if (num === activeDefenseString) setActiveMatchup(num);
    else if (num === 1 && activeDefenseString === 2) setActiveMatchup('1v2');
    else if (num === 2 && activeDefenseString === 1) setActiveMatchup('2v1');
    else setActiveMatchup(num);
  };

  const handleSetDefenseString = (num: 1 | 2 | 3) => {
    setActiveDefenseString(num);
    if (activeOffenseString === num) setActiveMatchup(num);
    else if (activeOffenseString === 1 && num === 2) setActiveMatchup('1v2');
    else if (activeOffenseString === 2 && num === 1) setActiveMatchup('2v1');
    else setActiveMatchup(num);
  };

  const handleSwapActiveMatchupSides = () => {
    const nextOff = activeDefenseString;
    const nextDef = activeOffenseString;
    setActiveOffenseString(nextOff);
    setActiveDefenseString(nextDef);
    if (nextOff === 1 && nextDef === 2) setActiveMatchup('1v2');
    else if (nextOff === 2 && nextDef === 1) setActiveMatchup('2v1');
    else if (nextOff === nextDef) setActiveMatchup(nextOff);
  };

  const handleNextSlide = () => {
    if (activeMatchup === 1) handleSelectMatchup('1v2');
    else if (activeMatchup === '1v2') handleSelectMatchup(2);
    else if (activeMatchup === 2) handleSelectMatchup('2v1');
    else if (activeMatchup === '2v1') handleSelectMatchup(3);
    else if (activeMatchup === 3) handleSelectMatchup('all');
    else handleSelectMatchup(1);
  };

  const handlePrevSlide = () => {
    if (activeMatchup === 'all') handleSelectMatchup(3);
    else if (activeMatchup === 3) handleSelectMatchup('2v1');
    else if (activeMatchup === '2v1') handleSelectMatchup(2);
    else if (activeMatchup === 2) handleSelectMatchup('1v2');
    else if (activeMatchup === '1v2') handleSelectMatchup(1);
    else handleSelectMatchup('all');
  };

  const handleNextMatchup = handleNextSlide;
  const handlePrevMatchup = handlePrevSlide;

  // Touch Swipe detection for mobile screen sliding
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe) {
      handleNextSlide();
    } else if (isRightSwipe) {
      handlePrevSlide();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // View presentation mode: 'side_by_side' | 'grid' | 'table'
  const [viewMode, setViewMode] = useState<'side_by_side' | 'grid' | 'table'>('side_by_side');

  // Filter unit: 'both' | 'offense' | 'defense'
  const [filterUnit, setFilterUnit] = useState<'both' | 'offense' | 'defense'>('both');

  // Inline editing state for drill title
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');

  // Inline editing for position slot name
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [editingPosName, setEditingPosName] = useState<string>('');

  // Quick player assignment modal
  const [assigningPos, setAssigningPos] = useState<{
    id: string;
    name: string;
    unit: 'offense' | 'defense';
    targetIdx?: number;
  } | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');

  // Auto-fill feedback toast
  const [autoFillFeedback, setAutoFillFeedback] = useState<string | null>(null);
  const [dropHoverKey, setDropHoverKey] = useState<string | null>(null);

  // Auto-fill options modal
  const [showAutoFillModal, setShowAutoFillModal] = useState<boolean>(false);

  // Color picker open states
  const [showColorPicker, setShowColorPicker] = useState<'offense' | 'defense' | null>(null);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printScope, setPrintScope] = useState<'active' | 'all'>('active');
  const [includePrintRepLog, setIncludePrintRepLog] = useState<boolean>(true);

  // Quick Add Slot popup
  const [showAddSlotUnit, setShowAddSlotUnit] = useState<'offense' | 'defense' | null>(null);
  const [customSlotName, setCustomSlotName] = useState<string>('');

  // --------------------------------------------------------------------------
  // DYNAMIC TEAM LABELS MANAGEMENT (Add, Delete, Persist)
  // --------------------------------------------------------------------------
  const [offenseCustomLabels, setOffenseCustomLabels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('football_offense_team_labels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_OFFENSE_LABELS;
  });

  const [defenseCustomLabels, setDefenseCustomLabels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('football_defense_team_labels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_DEFENSE_LABELS;
  });

  const [newOffenseLabelInput, setNewOffenseLabelInput] = useState<string>('');
  const [newDefenseLabelInput, setNewDefenseLabelInput] = useState<string>('');

  // Helper to commit updated groups and notify parent
  const updateGroup = (updated: LiveDrillGroup) => {
    const stamped = { ...updated, lastEdited: Date.now() };
    setLocalGroups((prev) => {
      const previous = prev.find((g) => g.id === stamped.id);
      const slotsChanged =
        !previous ||
        JSON.stringify(previous.offensePositions) !== JSON.stringify(stamped.offensePositions) ||
        JSON.stringify(previous.defensePositions) !== JSON.stringify(stamped.defensePositions);
      if (slotsChanged) captureLiveDrillSlotLayout(stamped);
      const next = prev.map((g) => (g.id === stamped.id ? stamped : g));
      groupsRef.current = next;
      onUpdatePracticeDrillGroups(next);
      return next;
    });
  };

  const handleAddOffenseLabel = (labelToAdd?: string) => {
    const val = (labelToAdd !== undefined ? labelToAdd : newOffenseLabelInput).trim();
    if (!val) return;
    const exists = offenseCustomLabels.some((l) => l.toLowerCase() === val.toLowerCase());
    const nextList = exists ? offenseCustomLabels : [...offenseCustomLabels, val];
    setOffenseCustomLabels(nextList);
    try {
      localStorage.setItem('football_offense_team_labels', JSON.stringify(nextList));
    } catch (e) {}
    handleUpdateOffenseLabel(val, customizingTeamOffense);
    setNewOffenseLabelInput('');
  };

  const handleDeleteOffenseLabel = (labelToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = offenseCustomLabels.filter((l) => l !== labelToDelete);
    setOffenseCustomLabels(nextList);
    try {
      localStorage.setItem('football_offense_team_labels', JSON.stringify(nextList));
    } catch (e) {}
  };

  const handleAddDefenseLabel = (labelToAdd?: string) => {
    const val = (labelToAdd !== undefined ? labelToAdd : newDefenseLabelInput).trim();
    if (!val) return;
    const exists = defenseCustomLabels.some((l) => l.toLowerCase() === val.toLowerCase());
    const nextList = exists ? defenseCustomLabels : [...defenseCustomLabels, val];
    setDefenseCustomLabels(nextList);
    try {
      localStorage.setItem('football_defense_team_labels', JSON.stringify(nextList));
    } catch (e) {}
    handleUpdateDefenseLabel(val, customizingTeamDefense);
    setNewDefenseLabelInput('');
  };

  const handleDeleteDefenseLabel = (labelToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = defenseCustomLabels.filter((l) => l !== labelToDelete);
    setDefenseCustomLabels(nextList);
    try {
      localStorage.setItem('football_defense_team_labels', JSON.stringify(nextList));
    } catch (e) {}
  };

  // Multi-Team Label Resolvers
  const offenseTeam1Label = currentGroup.offenseTeam1Label || currentGroup.offenseLabel || '1st Team Offense';
  const offenseTeam2Label = currentGroup.offenseTeam2Label || '2nd Team Offense';
  const offenseTeam3Label = currentGroup.offenseTeam3Label || '3rd Team Offense';

  const getOffenseLabelForString = (str: 1 | 2 | 3) => {
    if (str === 1) return offenseTeam1Label;
    if (str === 2) return offenseTeam2Label;
    return offenseTeam3Label;
  };

  const defenseTeam1Label = currentGroup.defenseTeam1Label || currentGroup.defenseLabel || '1st Team Defense';
  const defenseTeam2Label = currentGroup.defenseTeam2Label || '2nd Team Defense';
  const defenseTeam3Label = currentGroup.defenseTeam3Label || '3rd Team Defense';

  const getDefenseLabelForString = (str: 1 | 2 | 3) => {
    if (str === 1) return defenseTeam1Label;
    if (str === 2) return defenseTeam2Label;
    return defenseTeam3Label;
  };

  // Multi-Team Color Resolvers
  const offenseTeam1Color = currentGroup.offenseColor || 'gold';
  const offenseTeam2Color = currentGroup.offenseTeam2Color || currentGroup.offenseColor || 'orange';
  const offenseTeam3Color = currentGroup.offenseTeam3Color || currentGroup.offenseColor || 'white';

  const getOffenseColorForString = (str: 1 | 2 | 3) => {
    if (str === 1) return offenseTeam1Color;
    if (str === 2) return offenseTeam2Color;
    return offenseTeam3Color;
  };

  const defenseTeam1Color = currentGroup.defenseColor || 'blue';
  const defenseTeam2Color = currentGroup.defenseTeam2Color || currentGroup.defenseColor || 'navy';
  const defenseTeam3Color = currentGroup.defenseTeam3Color || currentGroup.defenseColor || 'red';

  const getDefenseColorForString = (str: 1 | 2 | 3) => {
    if (str === 1) return defenseTeam1Color;
    if (str === 2) return defenseTeam2Color;
    return defenseTeam3Color;
  };

  const countFilledForString = (unit: 'offense' | 'defense', stringNum: 1 | 2 | 3) => {
    const positions = unit === 'offense' ? currentGroup.offensePositions : currentGroup.defensePositions;
    const idx = stringNum - 1;
    return positions.filter((p) => {
      const pl = (currentGroup.lineup[p.id] || [])[idx];
      return Boolean(pl && pl.num && pl.num !== '?');
    }).length;
  };

  const teamCount = getDrillTeamCount(currentGroup);
  const teamNums = drillTeamNumbers(teamCount);
  const togetherTitle =
    teamCount === 1 ? '1 Team' : teamCount === 2 ? 'Both Teams' : 'All 3 Together';
  const togetherPairs = teamNums.map((num) => `O-${num} vs D-${num}`).join(', ');

  const matchupBoardCards: {
    key: 1 | 2 | 3 | '1v2' | '2v1' | 'all';
    title: string;
    off?: 1 | 2 | 3;
    def?: 1 | 2 | 3;
  }[] = teamNums.map((num) => ({
    key: num,
    title: `O-${num} vs D-${num}`,
    off: num,
    def: num,
  }));

  const handleSetTeamCount = (count: 1 | 2 | 3) => {
    updateGroup({ ...currentGroup, teamCount: count });
    if (activeOffenseString > count) setActiveOffenseString(count);
    if (activeDefenseString > count) setActiveDefenseString(count);
  };

  // Active color configs for currently active on-field units
  const activeOffenseLabel = getOffenseLabelForString(activeOffenseString);
  const activeDefenseLabel = getDefenseLabelForString(activeDefenseString);

  const activeOffenseColorConfig = getTeamColorConfig(getOffenseColorForString(activeOffenseString), 'gold');
  const activeDefenseColorConfig = getTeamColorConfig(getDefenseColorForString(activeDefenseString), 'blue');

  const offenseColorConfig = activeOffenseColorConfig;
  const defenseColorConfig = activeDefenseColorConfig;

  // Color change handlers
  const handleUpdateOffenseColor = (colorHexOrId: string, teamNum: 1 | 2 | 3 = customizingTeamOffense) => {
    if (teamNum === 1) {
      updateGroup({ ...currentGroup, offenseColor: colorHexOrId });
    } else if (teamNum === 2) {
      updateGroup({ ...currentGroup, offenseTeam2Color: colorHexOrId });
    } else {
      updateGroup({ ...currentGroup, offenseTeam3Color: colorHexOrId });
    }
  };

  const handleUpdateDefenseColor = (colorHexOrId: string, teamNum: 1 | 2 | 3 = customizingTeamDefense) => {
    if (teamNum === 1) {
      updateGroup({ ...currentGroup, defenseColor: colorHexOrId });
    } else if (teamNum === 2) {
      updateGroup({ ...currentGroup, defenseTeam2Color: colorHexOrId });
    } else {
      updateGroup({ ...currentGroup, defenseTeam3Color: colorHexOrId });
    }
  };

  // Label change handlers
  const handleUpdateOffenseLabel = (newLabel: string, teamNum: 1 | 2 | 3 = customizingTeamOffense) => {
    if (teamNum === 1) {
      updateGroup({ ...currentGroup, offenseLabel: newLabel, offenseTeam1Label: newLabel });
    } else if (teamNum === 2) {
      updateGroup({ ...currentGroup, offenseTeam2Label: newLabel });
    } else {
      updateGroup({ ...currentGroup, offenseTeam3Label: newLabel });
    }
  };

  const handleUpdateDefenseLabel = (newLabel: string, teamNum: 1 | 2 | 3 = customizingTeamDefense) => {
    if (teamNum === 1) {
      updateGroup({ ...currentGroup, defenseLabel: newLabel, defenseTeam1Label: newLabel });
    } else if (teamNum === 2) {
      updateGroup({ ...currentGroup, defenseTeam2Label: newLabel });
    } else {
      updateGroup({ ...currentGroup, defenseTeam3Label: newLabel });
    }
  };

  // --------------------------------------------------------------------------
  // TAB / DRILL MANAGEMENT
  // --------------------------------------------------------------------------
  const handleAddNewGroup = (format: LiveDrillFormat = '7v7') => {
    const gen = generateDefaultPositions(format);
    const newGroup: LiveDrillGroup = {
      id: `live_group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `New ${format.toUpperCase()} Practice Drill`,
      format,
      offenseLabel: format === '7v7' ? '1st Team Offense' : 'Varsity Offense',
      defenseLabel: format === '7v7' ? '1st Team Defense' : 'Varsity Defense',
      offenseColor: 'gold',
      defenseColor: 'blue',
      notes: '',
      offensePositions: gen.offense,
      defensePositions: gen.defense,
      lineup: {},
      teamCount: 3,
      createdAt: Date.now(),
    };
    const next = [...groups, newGroup];
    onUpdatePracticeDrillGroups(next);
    setActiveGroupId(newGroup.id);
  };

  const handleDuplicateGroup = (group: LiveDrillGroup) => {
    const copyId = `live_group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cloned: LiveDrillGroup = {
      ...group,
      id: copyId,
      name: `${group.name} (Copy)`,
      lineup: { ...group.lineup },
      createdAt: Date.now(),
    };
    const next = [...groups, cloned];
    onUpdatePracticeDrillGroups(next);
    setActiveGroupId(copyId);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (groups.length <= 1) {
      alert('You must keep at least one practice drill group.');
      return;
    }
    if (!confirm('Are you sure you want to delete this drill group?')) return;
    const remaining = groups.filter((g) => g.id !== groupId);
    onUpdatePracticeDrillGroups(remaining);
    if (activeGroupId === groupId) {
      setActiveGroupId(remaining[0].id);
    }
  };

  const handleChangeFormat = (newFormat: LiveDrillFormat) => {
    if (!currentGroup) return;
    if (newFormat === currentGroup.format) return;
    const shouldResetPositions = confirm(
      `Switch format to ${newFormat.toUpperCase()}? Reset position slots to default ${newFormat.toUpperCase()} layout? (Click Cancel to keep existing slots)`
    );

    if (shouldResetPositions) {
      const gen = generateDefaultPositions(newFormat);
      updateGroup({
        ...currentGroup,
        format: newFormat,
        offensePositions: gen.offense,
        defensePositions: gen.defense,
      });
    } else {
      updateGroup({
        ...currentGroup,
        format: newFormat,
      });
    }
  };

  // --------------------------------------------------------------------------
  // QUANTITY & POSITION SLOT CUSTOMIZATION
  // --------------------------------------------------------------------------
  const handleAdjustQuantity = (unit: 'offense' | 'defense', delta: number) => {
    if (!currentGroup) return;
    const positions = unit === 'offense' ? currentGroup.offensePositions : currentGroup.defensePositions;
    const newCount = positions.length + delta;
    if (newCount < 1) return;
    if (newCount > 22) return;

    if (delta > 0) {
      // Add a slot
      const ts = Date.now();
      const nextNum = newCount;
      const defaultName = unit === 'offense' ? `Skill / Slot ${nextNum}` : `Defender ${nextNum}`;
      const newPos: LiveDrillPosition = {
        id: `pos_${unit}_${ts}_${Math.random().toString(36).substring(2, 6)}`,
        name: defaultName,
        unit,
      };
      if (unit === 'offense') {
        updateGroup({
          ...currentGroup,
          offensePositions: [...currentGroup.offensePositions, newPos],
        });
      } else {
        updateGroup({
          ...currentGroup,
          defensePositions: [...currentGroup.defensePositions, newPos],
        });
      }
    } else {
      // Remove last slot
      const lastPos = positions[positions.length - 1];
      const nextLineup = { ...currentGroup.lineup };
      if (lastPos) {
        delete nextLineup[lastPos.id];
      }
      if (unit === 'offense') {
        updateGroup({
          ...currentGroup,
          offensePositions: currentGroup.offensePositions.slice(0, -1),
          lineup: nextLineup,
        });
      } else {
        updateGroup({
          ...currentGroup,
          defensePositions: currentGroup.defensePositions.slice(0, -1),
          lineup: nextLineup,
        });
      }
    }
  };

  const handleApplyPresetQuantity = (unit: 'offense' | 'defense', formatPreset: LiveDrillFormat) => {
    if (!currentGroup) return;
    const gen = generateDefaultPositions(formatPreset);
    const newPositions = unit === 'offense' ? gen.offense : gen.defense;

    if (unit === 'offense') {
      updateGroup({
        ...currentGroup,
        offensePositions: newPositions,
      });
    } else {
      updateGroup({
        ...currentGroup,
        defensePositions: newPositions,
      });
    }
  };

  const handleAddSingleSlot = (unit: 'offense' | 'defense', slotName: string) => {
    if (!currentGroup || !slotName.trim()) return;
    const ts = Date.now();
    const newPos: LiveDrillPosition = {
      id: `pos_${unit}_${ts}_${Math.random().toString(36).substring(2, 6)}`,
      name: slotName.trim(),
      unit,
    };
    if (unit === 'offense') {
      updateGroup({
        ...currentGroup,
        offensePositions: [...currentGroup.offensePositions, newPos],
      });
    } else {
      updateGroup({
        ...currentGroup,
        defensePositions: [...currentGroup.defensePositions, newPos],
      });
    }
    setCustomSlotName('');
    setShowAddSlotUnit(null);
  };

  const handleRemovePositionSlot = (posId: string, unit: 'offense' | 'defense') => {
    if (!currentGroup) return;
    const nextLineup = { ...currentGroup.lineup };
    delete nextLineup[posId];

    if (unit === 'offense') {
      updateGroup({
        ...currentGroup,
        offensePositions: currentGroup.offensePositions.filter((p) => p.id !== posId),
        lineup: nextLineup,
      });
    } else {
      updateGroup({
        ...currentGroup,
        defensePositions: currentGroup.defensePositions.filter((p) => p.id !== posId),
        lineup: nextLineup,
      });
    }
  };

  const handleMovePositionSlot = (posId: string, unit: 'offense' | 'defense', direction: 'up' | 'down') => {
    if (!currentGroup) return;
    const positions = unit === 'offense' ? [...currentGroup.offensePositions] : [...currentGroup.defensePositions];
    const idx = positions.findIndex((p) => p.id === posId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= positions.length) return;

    const temp = positions[idx];
    positions[idx] = positions[targetIdx];
    positions[targetIdx] = temp;

    if (unit === 'offense') {
      updateGroup({ ...currentGroup, offensePositions: positions });
    } else {
      updateGroup({ ...currentGroup, defensePositions: positions });
    }
  };

  const handleStartRenamePosition = (pos: LiveDrillPosition) => {
    setEditingPosId(pos.id);
    setEditingPosName(pos.name);
  };

  const handleSaveRenamePosition = () => {
    if (!editingPosId) return;
    const clean = editingPosName.trim();
    if (!clean) {
      setEditingPosId(null);
      return;
    }

    const current = groupsRef.current.find((g) => g.id === activeGroupId) || currentGroup;
    if (!current) return;
    const updateList = (list: LiveDrillPosition[]) =>
      list.map((p) => (p.id === editingPosId ? { ...p, name: clean } : p));

    updateGroup({
      ...current,
      offensePositions: updateList(current.offensePositions),
      defensePositions: updateList(current.defensePositions),
    });
    setEditingPosId(null);
  };

  // --------------------------------------------------------------------------
  // PLAYER ASSIGNMENTS & AUTO-FILL
  // --------------------------------------------------------------------------
  const resolveAssignUnit = (posId: string, group = currentGroup): 'offense' | 'defense' | null => {
    if (!group) return null;
    if (group.offensePositions.some((p) => p.id === posId)) return 'offense';
    if (group.defensePositions.some((p) => p.id === posId)) return 'defense';
    return null;
  };

  const handleAssignPlayer = (posId: string, player: PlacedPlayer, targetIdx?: number): boolean => {
    const liveGroup = groupsRef.current.find((g) => g.id === activeGroupId) || currentGroup;
    if (!liveGroup) return false;
    const unit = resolveAssignUnit(posId, liveGroup);
    if (!unit) return false;

    const linedUpPlayer: PlacedPlayer = {
      num: player.num,
      name: drillSpotLastName(player, roster),
    };

    const currentList = [...(liveGroup.lineup[posId] || [])];

    if (targetIdx !== undefined && targetIdx >= 0) {
      while (currentList.length <= targetIdx) {
        currentList.push({ num: '?', name: 'TBD' });
      }
      currentList[targetIdx] = linedUpPlayer;
      updateGroup({
        ...liveGroup,
        lineup: {
          ...liveGroup.lineup,
          [posId]: currentList,
        },
      });
      return true;
    }

    updateGroup({
      ...liveGroup,
      lineup: {
        ...liveGroup.lineup,
        [posId]: [...currentList, linedUpPlayer],
      },
    });
    return true;
  };

  const handlePromoteToActive = (posId: string, fromIndex: number, specificTargetIdx?: number) => {
    if (!currentGroup) return;
    const isOffense = currentGroup.offensePositions.some((p) => p.id === posId);
    const activeString = isOffense ? activeOffenseString : activeDefenseString;
    const targetIdx = specificTargetIdx !== undefined ? specificTargetIdx : activeString - 1;

    const list = [...(currentGroup.lineup[posId] || [])];
    const maxIdx = Math.max(targetIdx, fromIndex);
    while (list.length <= maxIdx) {
      list.push({ num: '?', name: 'TBD' });
    }
    const temp = list[targetIdx];
    list[targetIdx] = list[fromIndex];
    list[fromIndex] = temp;

    updateGroup({
      ...currentGroup,
      lineup: {
        ...currentGroup.lineup,
        [posId]: list,
      },
    });
  };

  const handleRemovePlayer = (posId: string, playerIndex: number) => {
    const liveGroup = groupsRef.current.find((g) => g.id === activeGroupId) || currentGroup;
    if (!liveGroup) return;
    const currentList = [...(liveGroup.lineup[posId] || [])];
    if (playerIndex >= 0 && playerIndex < 3) {
      while (currentList.length <= playerIndex) {
        currentList.push({ num: '?', name: 'TBD' });
      }
      currentList[playerIndex] = { num: '?', name: 'TBD' };
    } else {
      currentList.splice(playerIndex, 1);
    }
    updateGroup({
      ...liveGroup,
      lineup: {
        ...liveGroup.lineup,
        [posId]: currentList,
      },
    });
  };

  const handleClearLineup = (unit?: 'offense' | 'defense') => {
    if (!currentGroup) return;
    if (!confirm(`Clear player assignments for ${unit ? unit.toUpperCase() : 'this entire drill'}?`)) return;

    if (!unit) {
      updateGroup({ ...currentGroup, lineup: {} });
      return;
    }

    const nextLineup = { ...currentGroup.lineup };
    const positionsToClear = unit === 'offense' ? currentGroup.offensePositions : currentGroup.defensePositions;
    positionsToClear.forEach((p) => {
      delete nextLineup[p.id];
    });
    updateGroup({ ...currentGroup, lineup: nextLineup });
  };

  const handleRunAutoFill = (options: {
    targetString: 1 | 2 | 3 | 'all';
    balanceMode?: 'pure_depth' | 'semi_balanced_head_to_head' | 'even_mix';
    fillUnit: 'both' | 'offense' | 'defense';
  }) => {
    if (!currentGroup) return;
    const result = executeIntelligentAutoFill({
      group: currentGroup,
      formations,
      depthChart,
      scrimmageChart,
      roster,
      targetString: options.targetString,
      balanceMode: options.balanceMode || 'pure_depth',
      fillUnit: options.fillUnit,
    });

    updateGroup({
      ...currentGroup,
      lineup: result.nextLineup,
    });

    if (options.balanceMode === 'semi_balanced_head_to_head') {
      setActiveOffenseString(1);
      setActiveDefenseString(2);
      setActiveMatchup('1v2');
    }

    const parts: string[] = [];
    if (options.balanceMode === 'semi_balanced_head_to_head') {
      parts.push(`⚔️ Semi-Balanced Teams Created: Team 1 and Team 2 are evenly matched with a 50/50 mix of 1st & 2nd stringers to go against each other.`);
    } else {
      parts.push(`Auto-filled ${result.summary.filledOffense}/${result.summary.totalOffense} Offense & ${result.summary.filledDefense}/${result.summary.totalDefense} Defense slots.`);
    }
    if (result.summary.startersMixed > 0 && options.balanceMode !== 'semi_balanced_head_to_head') {
      parts.push(`Balanced ${result.summary.startersMixed} starters evenly across 1s, 2s & 3s.`);
    }
    if (result.summary.backupsAdded > 0) {
      parts.push(`Assigned ${result.summary.backupsAdded} rotation backups (4th & 5th strings) for live playing time.`);
    }
    parts.push(`(${result.summary.sourceDescription})`);

    const msg = parts.join(' ');
    setAutoFillFeedback(msg);
    setTimeout(() => setAutoFillFeedback(null), 6000);
    setShowAutoFillModal(false);
  };

  const handleTriggerPrint = () => {
    setShowPrintModal(false);
    document.body.classList.add('is-printing', 'is-printing-drills');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('is-printing', 'is-printing-drills');
      }, 500);
    }, 150);
  };

  // Drag & drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropOnPosition = (e: React.DragEvent, posId: string, targetIdx?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropHoverKey(null);
    if (userRole !== 'admin') return;

    const dragged = parseDraggedPlacedPlayer(e);
    if (dragged) {
      handleAssignPlayer(posId, dragged, targetIdx);
      return;
    }

    const plainText = e.dataTransfer.getData('text/plain');
    const rosterPlayer = roster.find(
      (p) =>
        p.rosterName === plainText ||
        `${p.firstName} ${p.lastName}` === plainText ||
        p.lastName === plainText
    );
    if (rosterPlayer) {
      handleAssignPlayer(
        posId,
        {
          name: drillSpotLastName(rosterPlayer, roster),
          num: rosterPlayer.num,
        },
        targetIdx
      );
    }
  };

  const handleStartPlacedDrag = (e: React.DragEvent, player: PlacedPlayer) => {
    if (userRole !== 'admin' || !isFilledPlayer(player)) return;
    const name = drillSpotLastName(player, roster);
    e.dataTransfer.setData(FOOTBALL_PLAYER_DRAG, JSON.stringify({ num: player.num, name }));
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSwapOffenseDefense = () => {
    if (!currentGroup) return;
    if (!confirm('Swap Offense and Defense labels and colors for this drill?')) return;
    updateGroup({
      ...currentGroup,
      offenseLabel: currentGroup.defenseLabel,
      defenseLabel: currentGroup.offenseLabel,
      offenseColor: currentGroup.defenseColor || 'blue',
      defenseColor: currentGroup.offenseColor || 'gold',
    });
  };

  // Filtered roster for manual assignment search
  const filteredRoster = useMemo(() => {
    if (!playerSearchQuery.trim()) return roster;
    const q = playerSearchQuery.toLowerCase().trim();
    return roster.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.num.toLowerCase().includes(q) ||
        (p.primaryPosition || '').toLowerCase().includes(q)
    );
  }, [roster, playerSearchQuery]);

  return (
    <>
      <div className="space-y-6 pb-12 animate-in fade-in duration-200 print:hidden">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider shrink-0">Drill:</span>
            {groups.map((group) => {
              const isActive = group.id === currentGroup.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroupId(group.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer border ${
                    isActive
                      ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/50'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {group.name} <span className="opacity-60">{group.format.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAutoFillModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 font-bold text-xs cursor-pointer"
            >
              Auto-Fill
            </button>
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer"
            >
              Print
            </button>
          </div>
        </div>
        {autoFillFeedback && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
            <span>{autoFillFeedback}</span>
            <button type="button" onClick={() => setAutoFillFeedback(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. INTERACTIVE MATCHUP BOARD (OFFENSE VS DEFENSE - 3-TEAM DEPTH) */}
      {/* ==================================================================== */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-all"
      >
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-base">{togetherTitle}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {togetherPairs}. Drag from the roster on the right, or tap a cell to assign.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button type="button" onClick={() => setFilterUnit('both')} className={`px-2.5 py-1 rounded-lg ${filterUnit === 'both' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}>Both</button>
              <button type="button" onClick={() => setFilterUnit('offense')} className={`px-2.5 py-1 rounded-lg ${filterUnit === 'offense' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs' : 'text-slate-500'}`}>Offense</button>
              <button type="button" onClick={() => setFilterUnit('defense')} className={`px-2.5 py-1 rounded-lg ${filterUnit === 'defense' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-xs' : 'text-slate-500'}`}>Defense</button>
            </div>
            <button type="button" onClick={() => setShowAddSlotUnit(showAddSlotUnit === 'offense' ? null : 'offense')} className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 font-bold text-xs cursor-pointer">+ Offense Slot</button>
            <button type="button" onClick={() => setShowAddSlotUnit(showAddSlotUnit === 'defense' ? null : 'defense')} className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700/60 font-bold text-xs cursor-pointer">+ Defense Slot</button>
          </div>
        </div>

        <div className="mb-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Teams</span>
            <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              {([1, 2, 3] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleSetTeamCount(count)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    teamCount === count
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {count} {count === 1 ? 'team' : 'teams'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['offense', 'defense'] as const).map((unit) => (
              <div key={unit}>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  {unit === 'offense' ? 'Offense names' : 'Defense names'}
                </div>
                <div className="space-y-1.5">
                  {teamNums.map((num) => (
                    <div key={`${unit}_${num}`} className="flex items-center gap-2">
                      <span className="w-6 text-[10px] font-black text-slate-400">{num}</span>
                      <input
                        value={unit === 'offense' ? getOffenseLabelForString(num) : getDefenseLabelForString(num)}
                        onChange={(e) =>
                          unit === 'offense'
                            ? handleUpdateOffenseLabel(e.target.value, num)
                            : handleUpdateDefenseLabel(e.target.value, num)
                        }
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                        aria-label={`${unit} team ${num} name`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-1 ${teamCount === 1 ? 'sm:grid-cols-1' : teamCount === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2 mb-4`}>
          {matchupBoardCards.map((card) => {
            const offCfg = getTeamColorConfig(getOffenseColorForString(card.off!), 'gold');
            const defCfg = getTeamColorConfig(getDefenseColorForString(card.def!), 'blue');
            const offFilled = countFilledForString('offense', card.off!);
            const defFilled = countFilledForString('defense', card.def!);
            return (
              <div key={String(card.key)} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{card.title}</div>
                <div className="flex items-center gap-1 min-w-0 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black truncate" style={{ backgroundColor: offCfg.hex, color: offCfg.badgeText.includes('white') ? '#fff' : '#000' }}>{getOffenseLabelForString(card.off!)}</span>
                  <span className="text-[10px] font-black text-slate-400">vs</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black truncate" style={{ backgroundColor: defCfg.hex, color: defCfg.badgeText.includes('white') ? '#fff' : '#000' }}>{getDefenseLabelForString(card.def!)}</span>
                </div>
                <div className="mt-1 text-[10px] font-bold text-slate-500">O {offFilled}/{currentGroup.offensePositions.length} · D {defFilled}/{currentGroup.defensePositions.length}</div>
              </div>
            );
          })}
        </div>

        {showAddSlotUnit && (
          <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase">Add {showAddSlotUnit} slot</span>
              <button type="button" onClick={() => setShowAddSlotUnit(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(showAddSlotUnit === 'offense' ? SUGGESTED_OFFENSE_TAGS : SUGGESTED_DEFENSE_TAGS).map((tag) => (
                <button key={tag} type="button" onClick={() => handleAddSingleSlot(showAddSlotUnit, tag)} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer">+ {tag}</button>
              ))}
            </div>
          </div>
        )}

{/* ------------------------------------------------------------------ */}
        {/* VIEW ALL MATCHUPS TOGETHER MODE */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h5 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                {togetherTitle} · who they match up against
              </h5>
              <span className="text-xs text-slate-500 font-medium">
                {togetherPairs}. Red box = same player on offense and defense for that team.
              </span>
            </div>

            {(['offense', 'defense'] as const)
              .filter((unit) => filterUnit === 'both' || filterUnit === unit)
              .map((unit) => {
                const positions = unit === 'offense' ? currentGroup.offensePositions : currentGroup.defensePositions;
                return (
                  <div
                    key={unit}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div
                      className={`px-3 py-2 text-[11px] font-black uppercase tracking-wider ${
                        unit === 'offense'
                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                          : 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200'
                      }`}
                    >
                      {unit === 'offense' ? 'Offense rotations' : 'Defense rotations'}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">
                            <th className="px-3 py-2 text-left font-black w-20">Slot</th>
                            {teamNums.map((num) => {
                              const cfg = getTeamColorConfig(
                                unit === 'offense' ? getOffenseColorForString(num) : getDefenseColorForString(num),
                                unit === 'offense' ? 'gold' : 'blue'
                              );
                              const vsCfg = getTeamColorConfig(
                                unit === 'offense' ? getDefenseColorForString(num) : getOffenseColorForString(num),
                                unit === 'offense' ? 'blue' : 'gold'
                              );
                              const selfLabel =
                                unit === 'offense' ? getOffenseLabelForString(num) : getDefenseLabelForString(num);
                              const vsLabel =
                                unit === 'offense' ? getDefenseLabelForString(num) : getOffenseLabelForString(num);
                              return (
                                <th key={num} className="px-3 py-2 text-left font-black">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px]"
                                      style={{
                                        backgroundColor: cfg.hex,
                                        color: cfg.badgeText.includes('white') ? '#fff' : '#000',
                                      }}
                                    >
                                      {num}s {selfLabel}
                                    </span>
                                    <span className="text-slate-400">vs</span>
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px]"
                                      style={{
                                        backgroundColor: vsCfg.hex,
                                        color: vsCfg.badgeText.includes('white') ? '#fff' : '#000',
                                      }}
                                    >
                                      {vsLabel}
                                    </span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map((pos) => (
                            <tr key={`${unit}_${pos.id}`} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-1.5 font-black text-slate-600 dark:text-slate-300">
                                {editingPosId === pos.id ? (
                                  <input
                                    autoFocus
                                    value={editingPosName}
                                    onChange={(e) => setEditingPosName(e.target.value)}
                                    onBlur={handleSaveRenamePosition}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveRenamePosition();
                                      if (e.key === 'Escape') setEditingPosId(null);
                                    }}
                                    className="w-24 px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    aria-label="Slot name"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartRenamePosition(pos)}
                                    title="Rename this slot"
                                    className="font-black text-left hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
                                  >
                                    {pos.name}
                                  </button>
                                )}
                              </td>
                              {teamNums.map((num) => {
                                const player = (currentGroup.lineup[pos.id] || [])[num - 1];
                                const cfg = getTeamColorConfig(
                                  unit === 'offense' ? getOffenseColorForString(num) : getDefenseColorForString(num),
                                  unit === 'offense' ? 'gold' : 'blue'
                                );
                                const cellKey = `${pos.id}_${num}`;
                                const isHover = dropHoverKey === cellKey;
                                const onBothSides =
                                  Boolean(player && isFilledPlayer(player)) &&
                                  bothSideByTeam[num - 1].has(normalizeJerseyNum(player.num));
                                return (
                                  <td
                                    key={cellKey}
                                    className={`px-3 py-1.5 ${isHover ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-inset ring-indigo-400' : ''}`}
                                    onDragOver={(e) => {
                                      handleDragOver(e);
                                      setDropHoverKey(cellKey);
                                    }}
                                    onDragLeave={() => {
                                      setDropHoverKey((prev) => (prev === cellKey ? null : prev));
                                    }}
                                    onDrop={(e) => handleDropOnPosition(e, pos.id, num - 1)}
                                  >
                                    {player && player.num !== '?' ? (
                                      <div
                                        draggable={userRole === 'admin'}
                                        onDragStart={(e) => handleStartPlacedDrag(e, player)}
                                        title={
                                          onBothSides
                                            ? `#${player.num} is on both sides of this matchup (O-${num} vs D-${num})`
                                            : undefined
                                        }
                                        className={`flex items-center gap-1.5 min-w-0 rounded-md px-1 py-0.5 ${
                                          userRole === 'admin' ? 'cursor-grab' : ''
                                        } ${onBothSides ? 'ring-2 ring-rose-600 border border-rose-600 bg-rose-50 dark:bg-rose-950/40' : ''}`}
                                      >
                                        <span
                                          className="w-6 h-6 rounded text-[10px] font-black flex items-center justify-center shrink-0"
                                          style={{
                                            backgroundColor: cfg.hex,
                                            color: cfg.badgeText.includes('white') ? '#fff' : '#000',
                                          }}
                                        >
                                          {player.num}
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-white truncate">
                                          {drillSpotLastName(player, roster)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePlayer(pos.id, num - 1)}
                                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer ml-auto"
                                          title="Remove player"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAssigningPos({
                                            id: pos.id,
                                            name: pos.name,
                                            unit,
                                            targetIdx: num - 1,
                                          })
                                        }
                                        className="w-full text-left py-1 text-[11px] font-bold text-slate-400 hover:text-indigo-600 cursor-pointer"
                                      >
                                        + Drop or assign
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
              </div>

      {/* ==================================================================== */}
      {/* 4. AUTO-FILL INTELLIGENT MODAL */}
      {/* ==================================================================== */}
      {showAutoFillModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Auto-Fill Drill Matchups
                  </h3>
                  <p className="text-xs text-slate-500">
                    Smart Depth Chart population with balanced competition
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutoFillModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Depth Chart Rules Verification Notice */}
            <div className="mt-4 p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-xs">
              <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 mb-1">
                <span>🛡️ Formation Depth Chart Rules:</span>
              </div>
              <ul className="text-indigo-800/90 dark:text-indigo-300/80 space-y-1 text-[11px] list-disc list-inside">
                <li><strong>Strict Position Mapping (QB is QB, etc.)</strong>: Players are only placed into drill slots that match their exact position on your offensive or defensive formations.</li>
                {currentGroup?.format === '7v7' && (
                  <li><strong>7v7 backfield</strong>: 1 is QB, 2 is FB (H), and 3/4 are RB. A player who starts two positions gets reps at both. The top QB gets most of the QB reps.</li>
                )}
                <li><strong>Formation Colors to Teams</strong>: <strong>Black (1st string)</strong> fills Team 1, <strong>Gold (2nd string)</strong> fills Team 2, and <strong>Blue (3rd string)</strong> fills Team 3.</li>
                <li><strong>4th & 5th String Backups</strong>: Deep formation backups populate active rotation slots so all athletes get practice reps.</li>
              </ul>
            </div>

            <div className="space-y-3.5 py-4">
              {/* PRIMARY: FORMATION DEPTH AUTO-FILL (Black=1, Gold=2, Blue=3) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/40 dark:from-indigo-950/40 dark:to-blue-950/30 border-2 border-indigo-500/80 dark:border-indigo-500/70 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider">
                    Primary Formation Mapping
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    Black=1 • Gold=2 • Blue=3
                  </span>
                </div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">
                  📋 Auto-Fill from Formation Depth Chart
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-3">
                  Directly loads players from your offensive & defensive formations into their exact positions (QB is QB, RB is RB, LT is LT, MLB is MLB). Black (1st string) goes to Team 1, Gold (2nd string) goes to Team 2, Blue (3rd string) goes to Team 3, and 4th/5th strings populate backup rotations.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'pure_depth', fillUnit: 'both' })}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-Fill All 3 Teams (Offense & Defense)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'pure_depth', fillUnit: 'offense' })}
                      className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 font-bold text-xs text-indigo-900 dark:text-indigo-200 cursor-pointer text-center transition-all"
                    >
                      Offense Only (Formations)
                    </button>
                    <button
                      onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'pure_depth', fillUnit: 'defense' })}
                      className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-100/60 dark:hover:bg-blue-950/60 border border-blue-300 dark:border-blue-700 font-bold text-xs text-blue-900 dark:text-blue-200 cursor-pointer text-center transition-all"
                    >
                      Defense Only (Formations)
                    </button>
                  </div>
                </div>
              </div>

              {/* USER REQUESTED: SEMI-BALANCED HEAD-TO-HEAD SCRIMMAGE (Team 1 vs Team 2) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/40 dark:to-indigo-950/40 border-2 border-purple-400 dark:border-purple-600/80 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Swords className="w-3 h-3" />
                    <span>Head-to-Head Scrimmage</span>
                  </span>
                  <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5" />
                    <span>50/50 Talent Split</span>
                  </span>
                </div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">
                  ⚔️ Make Semi-Balanced Teams (Team 1 vs Team 2)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-3">
                  Distributes 1st string (Black) and 2nd string (Gold) players evenly 50/50 across Team 1 and Team 2 by position group so both squads are competitive to go against each other. Team 3 retains 3rd string (Blue), and 4th/5th string backups get rotation reps.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'semi_balanced_head_to_head', fillUnit: 'both' })}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Generate Semi-Balanced Teams (Offense & Defense)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'semi_balanced_head_to_head', fillUnit: 'offense' })}
                      className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100/60 dark:hover:bg-purple-950/60 border border-purple-300 dark:border-purple-700 font-bold text-xs text-purple-900 dark:text-purple-200 cursor-pointer text-center transition-all"
                    >
                      Semi-Balance Offense Only
                    </button>
                    <button
                      onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'semi_balanced_head_to_head', fillUnit: 'defense' })}
                      className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100/60 dark:hover:bg-purple-950/60 border border-purple-300 dark:border-purple-700 font-bold text-xs text-purple-900 dark:text-purple-200 cursor-pointer text-center transition-all"
                    >
                      Semi-Balance Defense Only
                    </button>
                  </div>
                </div>
              </div>

              {/* SECONDARY: BALANCED 3-TEAM MIX */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-slate-900 dark:text-white text-xs">
                    ⚖️ 3-Way Even Mix (Evenly Mix Across 1s, 2s & 3s)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold">All 3 Teams</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                  Mixes 1st, 2nd, and 3rd string depth evenly across all 3 teams so every squad has equal starter representation.
                </p>
                <button
                  onClick={() => handleRunAutoFill({ targetString: 'all', balanceMode: 'even_mix', fillUnit: 'both' })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold text-xs text-slate-800 dark:text-slate-100 cursor-pointer text-center transition-all"
                >
                  Run 3-Way Even Mix
                </button>
              </div>

              {/* INDIVIDUAL STRING QUICK FILLS */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Fill Specific String from Formations:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRunAutoFill({ targetString: 1, balanceMode: 'pure_depth', fillUnit: 'both' })}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-all"
                  >
                    <div className="font-black text-xs text-slate-900 dark:text-white">Team 1</div>
                    <div className="text-[10px] font-bold text-slate-500">Black (1st String)</div>
                  </button>
                  <button
                    onClick={() => handleRunAutoFill({ targetString: 2, balanceMode: 'pure_depth', fillUnit: 'both' })}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-all"
                  >
                    <div className="font-black text-xs text-slate-900 dark:text-white">Team 2</div>
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Gold (2nd String)</div>
                  </button>
                  <button
                    onClick={() => handleRunAutoFill({ targetString: 3, balanceMode: 'pure_depth', fillUnit: 'both' })}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-all"
                  >
                    <div className="font-black text-xs text-slate-900 dark:text-white">Team 3</div>
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Blue (3rd String)</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowAutoFillModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. PLAYER ASSIGNMENT SEARCH MODAL */}
      {/* ==================================================================== */}
      {assigningPos && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <span>Assign Player to</span>
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    {assigningPos.name}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Same player can take spots on both sides. A red box marks a jersey on both sides of the same matchup (O-1 vs D-1, O-2 vs D-2, O-3 vs D-3).
                </p>
              </div>
              <button
                onClick={() => setAssigningPos(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="my-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                placeholder="Search player name, jersey #, position..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {/* Roster list */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {filteredRoster.map((player) => {
                const linedUp = getPlayerLinedUpUnit(
                  groupsRef.current.find((g) => g.id === activeGroupId) || currentGroup,
                  player.num
                );
                return (
                <button
                  key={player.num}
                  onClick={() => {
                    const ok = handleAssignPlayer(
                      assigningPos.id,
                      {
                        name: drillSpotLastName(player, roster),
                        num: player.num,
                      },
                      assigningPos.targetIdx
                    );
                    if (ok) setAssigningPos(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all group bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/50 border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      #{player.num}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                        {player.firstName} {player.lastName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Pos: {player.primaryPosition || 'ATH'}
                        {linedUp ? ` · on ${linedUp}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {linedUp === assigningPos.unit ? '+ Another spot' : '+ Assign'}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. PRINT MODAL (PREVIEW & SCRIPT OPTIONS) */}
      {/* ==================================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Print Practice Cards & Scripts
                </h3>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              {/* Print Scope */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  Print Scope:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPrintScope('active')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      printScope === 'active'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-black text-xs">Current Drill Only</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {currentGroup.name}
                    </div>
                  </button>
                  <button
                    onClick={() => setPrintScope('all')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      printScope === 'all'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-black text-xs">All Practice Drills</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Full packet ({groups.length} Drills)
                    </div>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePrintRepLog}
                    onChange={(e) => setIncludePrintRepLog(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Include Sideline Live Rep & Snap Chart (for coaches to log reps)</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerPrint}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* ==================================================================== */}
      {/* 7. FIELD-READY PRINT LAYOUT (PRINT ONLY) */}
      {/* ==================================================================== */}
      <div className="hidden print:block font-sans text-slate-900 bg-white">
        {(printScope === 'active' ? [currentGroup] : groups).map((drill, dIdx) => {
          const dOffColor = getTeamColorConfig(drill.offenseColor, 'gold');
          const dDefColor = getTeamColorConfig(drill.defenseColor, 'blue');

          return (
            <div
              key={drill.id}
              className={`p-6 ${dIdx > 0 ? 'break-before-page' : ''}`}
              style={{ pageBreakInside: 'avoid' }}
            >
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight">
                    {activeTeam?.name || 'Football Operations'} — Practice Script & Matchup
                  </h1>
                  <p className="text-xs font-bold text-slate-700">
                    Week {currentWeek} • Drill: {drill.name} ({drill.format.toUpperCase()} Format)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase px-2 py-1 bg-slate-900 text-white rounded">
                    Field Script
                  </span>
                </div>
              </div>

              {/* Coaching Focus */}
              {drill.notes && (
                <div className="mb-4 p-2.5 bg-slate-100 border border-slate-300 rounded text-xs font-bold">
                  <span className="font-black uppercase">Coaching Focus / Notes: </span>
                  {drill.notes}
                </div>
              )}

              {/* Offense & Defense side-by-side tables */}
              <div className="grid grid-cols-2 gap-6 mb-5">
                {/* Offense */}
                <div>
                  <h2
                    className="text-sm font-black uppercase border-b-2 pb-1 mb-2 flex items-center justify-between"
                    style={{ borderColor: dOffColor.hex }}
                  >
                    <span>⚡ {drill.offenseLabel}</span>
                    <span className="text-xs text-slate-500 font-bold">
                      {drill.offensePositions.length} Slots
                    </span>
                  </h2>
                  <table className="w-full text-xs border border-slate-400">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="p-1 text-left border border-slate-400 w-14">Slot</th>
                        {drillTeamNumbers(getDrillTeamCount(drill)).map((num) => (
                          <th key={num} className="p-1 text-left border border-slate-400">
                            {num === 1
                              ? drill.offenseTeam1Label || drill.offenseLabel || '1st String'
                              : num === 2
                                ? drill.offenseTeam2Label || '2nd String'
                                : drill.offenseTeam3Label || '3rd String'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drill.offensePositions.map((pos) => {
                        const assigned = drill.lineup[pos.id] || [];
                        return (
                          <tr key={pos.id} className="border-b border-slate-300">
                            <td className="p-1 font-bold border border-slate-300 bg-slate-50">
                              {pos.name}
                            </td>
                            {drillTeamNumbers(getDrillTeamCount(drill)).map((num) => {
                              const player = assigned[num - 1];
                              return (
                                <td key={num} className="p-1 font-black border border-slate-300">
                                  {player && player.num !== '?'
                                    ? `#${player.num} ${drillSpotLastName(player, roster)}`
                                    : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Defense */}
                <div>
                  <h2
                    className="text-sm font-black uppercase border-b-2 pb-1 mb-2 flex items-center justify-between"
                    style={{ borderColor: dDefColor.hex }}
                  >
                    <span>🛡️ {drill.defenseLabel}</span>
                    <span className="text-xs text-slate-500 font-bold">
                      {drill.defensePositions.length} Slots
                    </span>
                  </h2>
                  <table className="w-full text-xs border border-slate-400">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="p-1 text-left border border-slate-400 w-14">Slot</th>
                        {drillTeamNumbers(getDrillTeamCount(drill)).map((num) => (
                          <th key={num} className="p-1 text-left border border-slate-400">
                            {num === 1
                              ? drill.defenseTeam1Label || drill.defenseLabel || '1st String'
                              : num === 2
                                ? drill.defenseTeam2Label || '2nd String'
                                : drill.defenseTeam3Label || '3rd String'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drill.defensePositions.map((pos) => {
                        const assigned = drill.lineup[pos.id] || [];
                        return (
                          <tr key={pos.id} className="border-b border-slate-300">
                            <td className="p-1 font-bold border border-slate-300 bg-slate-50">
                              {pos.name}
                            </td>
                            {drillTeamNumbers(getDrillTeamCount(drill)).map((num) => {
                              const player = assigned[num - 1];
                              return (
                                <td key={num} className="p-1 font-black border border-slate-300">
                                  {player && player.num !== '?'
                                    ? `#${player.num} ${drillSpotLastName(player, roster)}`
                                    : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sideline Rep Log Table */}
              {includePrintRepLog && (
                <div className="mt-4 pt-3 border-t border-slate-300">
                  <h3 className="text-xs font-black uppercase text-slate-800 mb-2">
                    Sideline Live Rep Log / Chart
                  </h3>
                  <table className="w-full text-[11px] border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-1 border border-slate-400 w-12 text-center">Rep #</th>
                        <th className="p-1 border border-slate-400 w-16 text-center">Hash</th>
                        <th className="p-1 border border-slate-400 text-left">Offense Play Call</th>
                        <th className="p-1 border border-slate-400 text-left">Defense Front / Coverage</th>
                        <th className="p-1 border border-slate-400 text-left">Result / Coaching Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6].map((rep) => (
                        <tr key={rep} className="border-b border-slate-300 h-6">
                          <td className="p-1 text-center font-bold border border-slate-300 bg-slate-50">
                            {rep}
                          </td>
                          <td className="p-1 text-center border border-slate-300"></td>
                          <td className="p-1 border border-slate-300"></td>
                          <td className="p-1 border border-slate-300"></td>
                          <td className="p-1 border border-slate-300"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
