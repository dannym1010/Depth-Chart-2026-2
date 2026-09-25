import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Printer,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Copy,
  Edit2,
  Trash2,
  Move,
  Settings2,
  GripHorizontal,
  X,
  Shield,
  Zap,
  Check,
  Minus,
  Sliders,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Eraser,
  SquarePlus,
  ArrowLeft,
  ArrowRight,
  Lock,
  Unlock,
  ShieldAlert,
  Smartphone,
  LayoutGrid,
  Search,
  Users,
  UserCheck,
  CheckCircle2,
  TableProperties,
  Sparkle,
  Layers,
  ArrowLeftRight,
  Upload,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import {
  FormationBoard,
  FormationRow,
  PositionSlot,
  PlacedPlayer,
  UserRole,
  UnitType,
  Team,
  RosterPlayer,
} from '../types';
import { triggerPrint } from '../utils/printUtils';
import { PocketDepthChartPrintModal } from './PocketDepthChartPrintModal';
import { FormationDepthChartPrintModal } from './FormationDepthChartPrintModal';
import { DismissibleTip } from './common/DismissibleTip';

interface FormationsViewProps {
  unit: 'offense' | 'defense' | 'st' | 'groups';
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  selectedFormationId: string | null;
  onSelectFormation: (formId: string) => void;
  userRole: UserRole;
  activeTeam?: Team;
  teams?: Team[];
  roster?: RosterPlayer[];
  isLockedByOther?: boolean;
  lockHolderName?: string;
  lockHolderEmail?: string;
  isHeldByMe?: boolean;
  onAcquireLock?: () => void;
  onReleaseLock?: () => void;
  onTakeOverLock?: () => void;
  onAssignPlayerDirect?: (posId: string, player: PlacedPlayer, targetIndex?: number) => void;
  onReorderDepthPlayer?: (posId: string, fromIndex: number, toIndex: number) => void;
  onCopyFormationsFromTeam?: (sourceTeamId: string) => void;
  onAddFormation?: (unit: 'offense' | 'defense' | 'st' | 'groups') => void;
  onMoveFormation: (formId: string, direction: number) => void;
  onDuplicateFormation?: (formId: string) => void;
  onRenameFormation?: (formId: string) => void;
  onDeleteFormation: (formId: string) => void;
  onAddRow?: (formId: string) => void;
  onEditRowName?: (formId: string, rIdx: number) => void;
  onEditRowSlots?: (formId: string, rIdx: number) => void;
  onDeleteRow: (formId: string, rIdx: number) => void;
  onAddPosition?: (formId: string, rIdx: number) => void;
  onEditPositionName?: (formId: string, rIdx: number, pIdx: number) => void;
  onMovePositionRow?: (formId: string, rIdx: number, pIdx: number) => void;
  onCopyPositionToOtherForm?: (formId: string, rIdx: number, pIdx: number) => void;
  onDeletePosition: (formId: string, rIdx: number, pIdx: number) => void;
  onDropPlayerOnCard: (
    targetPosId: string,
    targetFormId: string,
    targetRowId: string
  ) => void;
  onRemovePlayerFromCard: (posId: string, playerIndex: number) => void;
  onOpenSelectivePrintModal: (unit: 'offense' | 'defense' | 'st' | 'groups') => void;
  onOpenCopyWeekModal?: () => void;
  onOpenImportModal?: () => void;
  onRestoreDefaultFormations?: (unit: 'offense' | 'defense' | 'st' | 'groups') => void;
  onDragStartPlacedPlayer: (
    e: React.DragEvent,
    posId: string,
    idx: number,
    player: PlacedPlayer
  ) => void;
  onPositionCardDragStart: (
    e: React.DragEvent,
    formId: string,
    rIdx: number,
    pIdx: number
  ) => void;
  onPositionCardDropOnSlot: (
    e: React.DragEvent,
    targetFormId: string,
    targetRIdx: number,
    targetPIdx: number
  ) => void;
  // Direct interactive handlers
  onSetRowSlots?: (formId: string, rIdx: number, count: number) => void;
  onAddSlotToRow?: (formId: string, rIdx: number) => void;
  onRemoveSlotFromRow?: (formId: string, rIdx: number, pIdx?: number) => void;
  onInsertSlotAt?: (formId: string, rIdx: number, pIdx: number) => void;
  onClearPositionToEmpty?: (formId: string, rIdx: number, pIdx: number) => void;
  onAssignPositionToSlot?: (formId: string, rIdx: number, pIdx: number, posName: string) => void;
  onAddPositionDirect?: (formId: string, rIdx: number, posName: string) => void;
  onRenamePositionDirect?: (formId: string, rIdx: number, pIdx: number, newName: string) => void;
  onRenameRowDirect?: (formId: string, rIdx: number, newName: string) => void;
  onAddRowDirect?: (formId: string, label: string, slotCount?: number) => void;
  onAddFormationDirect?: (unit: 'offense' | 'defense' | 'st' | 'groups', name: string, templateKey?: string) => void;
  onRenameFormationDirect?: (formId: string, newName: string) => void;
  onDuplicateFormationDirect?: (formId: string, newName: string) => void;
  onMovePositionDirect?: (formId: string, srcRIdx: number, srcPIdx: number, targetRIdx: number) => void;
  onCopyPositionDirect?: (formId: string, srcRIdx: number, srcPIdx: number, targetFormId: string) => void;
}

const OFFENSE_PRESET_TAGS = [
  'QB', '1 (QB)', 'FB', '2 (FB)', 'RB', '3 (RB)', '4 (RB)',
  'X', 'Z', 'W', 'Y', 'TE', 'Y1', 'Slot', 'H-Back',
  'LT', 'LG', 'C', 'RG', 'RT', 'OL',
];

const DEFENSE_PRESET_TAGS = [
  'DE', 'WDE', 'SDE', 'LDE', 'RDE', 'DT', 'LDT', 'RDT', 'NT', 'DL',
  'MLB', 'MIKE', 'WLB', 'WILL', 'SLB', 'SAM', 'ROV', 'OLB', 'ILB',
  'CB', 'LCB', 'RCB', 'FS', 'SS', 'DB', 'Nickel', 'Dime',
];

const SPECIAL_TEAMS_PRESET_TAGS = [
  'K', 'P', 'LS', 'H (Holder)', 'KR', 'PR', 'Gunner', 'Upback', 'PP',
  'L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5',
];

const FORMATION_TEMPLATES = {
  offense: [
    { key: '11_offense', label: '11 Personnel (1 RB, 1 TE, 3 WR)', desc: 'Standard 3-WR Pro Set with LT-RT and Backfield' },
    { key: '12_offense', label: '12 Personnel (1 RB, 2 TE, 2 WR)', desc: 'Heavy balanced tight end offense' },
    { key: '21_offense', label: '21 I-Formation (2 RB, 1 TE, 2 WR)', desc: 'Power run with QB under center and Fullback' },
    { key: 'spread_offense', label: 'Spread / 10 Personnel (4 WR, 1 RB)', desc: 'Gun 4-wide spread formation' },
    { key: 'empty_offense', label: 'Empty Backfield (5 WR / Flex)', desc: 'Quick pass spread attack' },
  ],
  defense: [
    { key: '44_defense', label: '4-4 Base Defense', desc: '4 DL, 4 LBs (Will/Mike/Sam/Rover), 3 DBs' },
    { key: '43_defense', label: '4-3 Over Defense', desc: '4 DL, 3 LBs, 4 DBs (2 CB, FS, SS)' },
    { key: '34_defense', label: '3-4 Defense', desc: '3 DL, 4 LBs (2 OLB, 2 ILB), 4 DBs' },
    { key: '53_defense', label: '5-3 Youth Defense', desc: '5 DL, 3 LBs, 3 DBs run-stopping wall' },
    { key: 'nickel_defense', label: 'Nickel Defense (4-2-5)', desc: '4 DL, 2 LBs, 5 DBs (Nickel Back)' },
  ],
  st: [
    { key: 'punt_st', label: 'Punt Coverage', desc: '7 Line + PP + Punter + 2 Gunners' },
    { key: 'kickoff_st', label: 'Kickoff Team', desc: '10 Coverage Players + Kicker' },
    { key: 'pat_st', label: 'Field Goal / PAT', desc: '7 Line + 2 Wing + Holder + Kicker' },
    { key: 'hands_st', label: 'Onside Hands Team', desc: 'Frontline Hands + Safety Returners' },
  ],
  groups: [
    { key: 'depth_groups', label: 'Custom Position Groups', desc: 'Multi-level drill & depth evaluation board' },
  ],
};

const ROW_PRESET_LABELS = [
  'Offensive Line & TE',
  'Wide Receivers & Slots',
  'Backfield (QB & RB)',
  'Defensive Line (DE / DT / NT)',
  'Linebackers (WLB / MLB / SLB)',
  'Secondary & Safeties (CB / FS / SS)',
  'Front Line Coverage',
  'Specialists & Returners',
  'Main Level',
  'Secondary Level',
  'Third Level',
];

export const FormationsView: React.FC<FormationsViewProps> = ({
  unit,
  formations,
  depthChart,
  selectedFormationId,
  onSelectFormation,
  userRole,
  activeTeam,
  teams = [],
  roster = [],
  isLockedByOther,
  lockHolderName,
  lockHolderEmail,
  isHeldByMe,
  onAcquireLock,
  onReleaseLock,
  onTakeOverLock,
  onAssignPlayerDirect,
  onReorderDepthPlayer,
  onCopyFormationsFromTeam,
  onAddFormation,
  onMoveFormation,
  onDuplicateFormation,
  onRenameFormation,
  onDeleteFormation,
  onAddRow,
  onEditRowName,
  onEditRowSlots,
  onDeleteRow,
  onAddPosition,
  onEditPositionName,
  onMovePositionRow,
  onCopyPositionToOtherForm,
  onDeletePosition,
  onDropPlayerOnCard,
  onRemovePlayerFromCard,
  onOpenSelectivePrintModal,
  onOpenCopyWeekModal,
  onOpenImportModal,
  onRestoreDefaultFormations,
  onDragStartPlacedPlayer,
  onPositionCardDragStart,
  onPositionCardDropOnSlot,
  // Direct in-app handlers
  onSetRowSlots,
  onAddSlotToRow,
  onRemoveSlotFromRow,
  onInsertSlotAt,
  onClearPositionToEmpty,
  onAssignPositionToSlot,
  onAddPositionDirect,
  onRenamePositionDirect,
  onRenameRowDirect,
  onAddRowDirect,
  onAddFormationDirect,
  onRenameFormationDirect,
  onDuplicateFormationDirect,
  onMovePositionDirect,
  onCopyPositionDirect,
}) => {
  const [filterViewId, setFilterViewId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'field' | 'mobile_cards'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile_cards';
    }
    return 'field';
  });
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [activeMobileFormationTab, setActiveMobileFormationTab] = useState<string>('ALL');
  const [mobileSubTab, setMobileSubTab] = useState<'pocket_chart' | 'player_matrix'>('pocket_chart');
  const [matrixFilter, setMatrixFilter] = useState<'ALL' | 'BLACK' | 'GOLD' | 'BLUE' | 'BACKUPS' | 'STARTERS' | 'ROTATION' | 'UNASSIGNED'>('ALL');
  const [quickSwapTarget, setQuickSwapTarget] = useState<{
    posId: string;
    posName: string;
    formId: string;
    formName: string;
    currentIndex: number;
    currentPlayer?: PlacedPlayer;
  } | null>(null);
  
  // Mobile Direct Player Picker Modal State
  const [assignPlayerModalTarget, setAssignPlayerModalTarget] = useState<{
    formId: string;
    formName: string;
    posId: string;
    posName: string;
    targetIndex?: number;
  } | null>(null);
  const [playerPickerSearch, setPlayerPickerSearch] = useState('');
  const [playerPickerPosFilter, setPlayerPickerPosFilter] = useState<'ALL' | 'UNASSIGNED' | 'MATCHING'>('ALL');

  const [dragOverPosId, setDragOverPosId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [isPocketPrintModalOpen, setIsPocketPrintModalOpen] = useState(false);
  const [selectedPocketPrintFormId, setSelectedPocketPrintFormId] = useState<string | null>(null);
  const [isFormationPrintModalOpen, setIsFormationPrintModalOpen] = useState(false);
  const [selectedFormationPrintId, setSelectedFormationPrintId] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceTeamId, setCopySourceTeamId] = useState(
    teams.find((t) => t.id !== activeTeam?.id)?.id || teams[0]?.id || ''
  );

  // In-App Modal Dialog States (Bypasses window.prompt in iframe)
  const [positionPickerTarget, setPositionPickerTarget] = useState<{
    formId: string;
    rIdx: number;
    pIdx: number;
    currentName?: string;
    isEdit?: boolean;
  } | null>(null);
  const [customPosInput, setCustomPosInput] = useState('');

  const [rowSlotsModalTarget, setRowSlotsModalTarget] = useState<{
    formId: string;
    rIdx: number;
    currentSlots: number;
    rowLabel: string;
  } | null>(null);
  const [rowSlotsCountInput, setRowSlotsCountInput] = useState<number>(7);

  const [rowLabelModalTarget, setRowLabelModalTarget] = useState<{
    formId: string;
    rIdx?: number;
    currentLabel?: string;
    isNew?: boolean;
  } | null>(null);
  const [rowLabelInput, setRowLabelInput] = useState('');

  const [formationModalState, setFormationModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'rename' | 'duplicate';
    formId?: string;
    unit: 'offense' | 'defense' | 'st' | 'groups';
    currentName?: string;
  }>({
    isOpen: false,
    mode: 'add',
    unit,
  });
  const [formationNameInput, setFormationNameInput] = useState('');
  const [formationTemplateKey, setFormationTemplateKey] = useState('');
  const [isPlaybookActionsDropdownOpen, setIsPlaybookActionsDropdownOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaybookActionsDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setIsPlaybookActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPlaybookActionsDropdownOpen]);

  const [openFormationMenuId, setOpenFormationMenuId] = useState<string | null>(null);

  // Dedicated In-App Delete Formation Confirmation Modal Target
  const [deleteFormationTarget, setDeleteFormationTarget] = useState<{
    formId: string;
    formName: string;
  } | null>(null);

  const [movePositionTarget, setMovePositionTarget] = useState<{
    formId: string;
    rIdx: number;
    pIdx: number;
    posName: string;
  } | null>(null);
  const [selectedTargetRowIdx, setSelectedTargetRowIdx] = useState<number>(0);

  const [copyPositionTarget, setCopyPositionTarget] = useState<{
    formId: string;
    rIdx: number;
    pIdx: number;
    posName: string;
  } | null>(null);
  const [selectedTargetFormId, setSelectedTargetFormId] = useState<string>('');

  const unitFormations = useMemo(
    () => formations.filter((f) => f && f.unit === unit),
    [formations, unit]
  );

  // Synchronous safe validation: never allow a stale filter ID to filter the view to empty
  const safeFilterViewId = useMemo(() => {
    if (filterViewId === 'ALL') return 'ALL';
    return unitFormations.some((f) => f && f.id === filterViewId) ? filterViewId : 'ALL';
  }, [filterViewId, unitFormations]);

  const safeMobileTab = useMemo(() => {
    if (activeMobileFormationTab === 'ALL') return 'ALL';
    return unitFormations.some((f) => f && f.id === activeMobileFormationTab)
      ? activeMobileFormationTab
      : 'ALL';
  }, [activeMobileFormationTab, unitFormations]);

  // Keep state in sync with valid choices
  useEffect(() => {
    if (filterViewId !== safeFilterViewId) {
      setFilterViewId(safeFilterViewId);
    }
  }, [filterViewId, safeFilterViewId]);

  useEffect(() => {
    if (activeMobileFormationTab !== safeMobileTab) {
      setActiveMobileFormationTab(safeMobileTab);
    }
  }, [activeMobileFormationTab, safeMobileTab]);

  // Automatically reset filters to ALL whenever the active unit changes
  useEffect(() => {
    setFilterViewId('ALL');
    setActiveMobileFormationTab('ALL');
  }, [unit]);

  const displayedFormations = useMemo(() => {
    if (safeFilterViewId === 'ALL') return unitFormations;
    const filtered = unitFormations.filter((f) => f.id === safeFilterViewId);
    return filtered.length > 0 ? filtered : unitFormations;
  }, [unitFormations, safeFilterViewId]);

  const mobileFormations = useMemo(() => {
    let list = unitFormations;
    if (safeMobileTab !== 'ALL') {
      const filtered = list.filter((f) => f.id === safeMobileTab);
      if (filtered.length > 0) return filtered;
    }
    if (safeFilterViewId !== 'ALL') {
      const filtered = list.filter((f) => f.id === safeFilterViewId);
      if (filtered.length > 0) return filtered;
    }
    return list;
  }, [unitFormations, safeMobileTab, safeFilterViewId]);

  const filteredRosterPlayers = useMemo(() => {
    if (!assignPlayerModalTarget) return [];
    let list = [...roster];
    const s = playerPickerSearch.trim().toLowerCase();
    if (s) {
      list = list.filter((p) => {
        const full = `${p.firstName || ''} ${p.lastName || ''} ${p.rosterName || ''}`.toLowerCase();
        return (
          full.includes(s) ||
          p.num.toLowerCase().includes(s) ||
          (p.primaryPosition && p.primaryPosition.toLowerCase().includes(s)) ||
          (p.secondaryPosition && p.secondaryPosition.toLowerCase().includes(s)) ||
          (p.offensivePosition && p.offensivePosition.toLowerCase().includes(s)) ||
          (p.defensivePosition && p.defensivePosition.toLowerCase().includes(s))
        );
      });
    }

    if (playerPickerPosFilter === 'MATCHING' && assignPlayerModalTarget.posName) {
      const targetPos = assignPlayerModalTarget.posName.toUpperCase().trim();
      list = list.filter((p) => {
        const p1 = (p.primaryPosition || '').toUpperCase();
        const p2 = (p.secondaryPosition || '').toUpperCase();
        const p3 = (p.offensivePosition || '').toUpperCase();
        const p4 = (p.defensivePosition || '').toUpperCase();
        return (
          (p1 && (p1.includes(targetPos) || targetPos.includes(p1))) ||
          (p2 && (p2.includes(targetPos) || targetPos.includes(p2))) ||
          (p3 && (p3.includes(targetPos) || targetPos.includes(p3))) ||
          (p4 && (p4.includes(targetPos) || targetPos.includes(p4)))
        );
      });
    } else if (playerPickerPosFilter === 'UNASSIGNED') {
      const placedNums = new Set<string>();
      const currentForm = formations.find((f) => f.id === assignPlayerModalTarget.formId);
      if (currentForm) {
        currentForm.rows.forEach((r) => {
          r.positions.forEach((pos) => {
            if (pos && depthChart[pos.id]) {
              depthChart[pos.id].forEach((pl) => placedNums.add(pl.num.trim()));
            }
          });
        });
      }
      list = list.filter((p) => !placedNums.has(p.num.trim()));
    }

    return list;
  }, [roster, assignPlayerModalTarget, playerPickerSearch, playerPickerPosFilter, formations, depthChart]);

  // Compute Player-First Assignment Matrix for all roster players across formations
  const playerAssignmentsMatrix = useMemo(() => {
    return roster.map((player) => {
      const playerName =
        `${player.firstName || ''} ${player.lastName || ''}`.trim() ||
        player.rosterName ||
        `#${player.num}`;
      const numTrim = (player.num || '').trim();

      const assignments: Array<{
        formId: string;
        formName: string;
        posId: string;
        posName: string;
        depthIndex: number;
        stringLabel: string;
        isStarter: boolean;
      }> = [];

      unitFormations.forEach((form) => {
        form.rows.forEach((row) => {
          row.positions.forEach((pos) => {
            if (pos && depthChart[pos.id]) {
              depthChart[pos.id].forEach((pl, idx) => {
                if (pl.num.trim() === numTrim) {
                  const stringLabel =
                    idx === 0 ? 'BLACK' : idx === 1 ? 'GOLD' : idx === 2 ? 'BLUE' : `BACKUP (D${idx + 1})`;
                  assignments.push({
                    formId: form.id,
                    formName: form.name,
                    posId: pos.id,
                    posName: pos.name,
                    depthIndex: idx,
                    stringLabel,
                    isStarter: idx === 0,
                  });
                }
              });
            }
          });
        });
      });

      const blackCount = assignments.filter((a) => a.depthIndex === 0).length;
      const goldCount = assignments.filter((a) => a.depthIndex === 1).length;
      const blueCount = assignments.filter((a) => a.depthIndex === 2).length;
      const backupCount = assignments.filter((a) => a.depthIndex >= 3).length;

      return {
        player,
        playerName,
        num: player.num,
        assignments,
        totalAssigned: assignments.length,
        starterCount: blackCount,
        blackCount,
        goldCount,
        blueCount,
        backupCount,
        rotationCount: goldCount + blueCount + backupCount,
        isUnassigned: assignments.length === 0,
      };
    });
  }, [roster, unitFormations, depthChart]);

  const filteredMatrixPlayers = useMemo(() => {
    let list = [...playerAssignmentsMatrix];
    const s = mobileSearchQuery.trim().toLowerCase();
    if (s) {
      list = list.filter((item) => {
        const full = `${item.playerName} ${item.num}`.toLowerCase();
        const p1 = (item.player.primaryPosition || '').toLowerCase();
        const p2 = (item.player.secondaryPosition || '').toLowerCase();
        const p3 = (item.player.offensivePosition || '').toLowerCase();
        const p4 = (item.player.defensivePosition || '').toLowerCase();
        const hasMatchingPos = item.assignments.some((a) =>
          a.posName.toLowerCase().includes(s) || a.formName.toLowerCase().includes(s)
        );
        return (
          full.includes(s) ||
          p1.includes(s) ||
          p2.includes(s) ||
          p3.includes(s) ||
          p4.includes(s) ||
          hasMatchingPos
        );
      });
    }

    if (matrixFilter === 'BLACK' || matrixFilter === 'STARTERS') {
      list = list.filter((item) => item.blackCount > 0);
    } else if (matrixFilter === 'GOLD') {
      list = list.filter((item) => item.goldCount > 0);
    } else if (matrixFilter === 'BLUE') {
      list = list.filter((item) => item.blueCount > 0);
    } else if (matrixFilter === 'BACKUPS' || matrixFilter === 'ROTATION') {
      list = list.filter((item) => item.backupCount > 0);
    } else if (matrixFilter === 'UNASSIGNED') {
      list = list.filter((item) => item.isUnassigned);
    }

    // Sort by jersey number numerically if possible, else alphabetically
    return list.sort((a, b) => {
      const numA = parseInt(a.num, 10);
      const numB = parseInt(b.num, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.num.localeCompare(b.num);
    });
  }, [playerAssignmentsMatrix, mobileSearchQuery, matrixFilter]);

  const teamDisplayName = activeTeam
    ? `${activeTeam.name} ${activeTeam.ageGroup ? `(${activeTeam.ageGroup})` : ''}`
    : 'Football Program';

  // Helper to trigger slot count change directly
  const handleDirectSetSlots = (formId: string, rIdx: number, newCount: number) => {
    const safeCount = Math.max(1, Math.min(12, newCount));
    if (onSetRowSlots) {
      onSetRowSlots(formId, rIdx, safeCount);
    } else if (onEditRowSlots) {
      onEditRowSlots(formId, rIdx);
    }
  };

  // Helper to add 1 slot to row
  const handleQuickAddSlot = (formId: string, rIdx: number, currentLen: number) => {
    if (currentLen >= 12) return;
    if (onAddSlotToRow) {
      onAddSlotToRow(formId, rIdx);
    } else {
      handleDirectSetSlots(formId, rIdx, currentLen + 1);
    }
  };

  // Helper to remove 1 slot from row
  const handleQuickRemoveSlot = (formId: string, rIdx: number, currentLen: number) => {
    if (currentLen <= 1) return;
    if (onRemoveSlotFromRow) {
      onRemoveSlotFromRow(formId, rIdx);
    } else {
      handleDirectSetSlots(formId, rIdx, currentLen - 1);
    }
  };

  // Preset suggestions based on unit
  const activePresetTags =
    unit === 'offense'
      ? OFFENSE_PRESET_TAGS
      : unit === 'defense'
      ? DEFENSE_PRESET_TAGS
      : unit === 'st'
      ? SPECIAL_TEAMS_PRESET_TAGS
      : [...OFFENSE_PRESET_TAGS.slice(0, 8), ...DEFENSE_PRESET_TAGS.slice(0, 8)];

  return (
    <div className="space-y-6">
      <DismissibleTip id="depth-chart-live-sync">
        Every coach can edit this depth chart at the same time; player moves and formation changes show up live on all screens.
      </DismissibleTip>

      {/* Top Action & Filter Toolbar */}
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-850/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200 dark:border-slate-750/90 shadow-sm dark:shadow-xl print:hidden">
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTeam && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shadow-inner">
              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 font-mono">
                Team:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{activeTeam.name}</span>
            </div>
          )}

          {/* View Mode Switcher (Mobile Cards vs Field Diagram) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-750 p-1 rounded-xl shadow-inner print:hidden">
            <button
              type="button"
              onClick={() => setViewMode('mobile_cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'mobile_cards'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Full-width cards and player assignment matrix"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('field')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'field'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="Field formation diagram"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Field</span>
            </button>
          </div>

          {/* On-screen view filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-750 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <select
              value={safeFilterViewId}
              onChange={(e) => setFilterViewId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">All Formations ({unitFormations.length})</option>
              {unitFormations.map((f) => (
                <option key={f.id} value={f.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls & Consolidated Dropdown */}
        <div className="flex items-center gap-2 flex-wrap relative">
          {userRole === 'admin' && (
            <>
              <button
                onClick={() => {
                  setFormationNameInput('');
                  setFormationTemplateKey(FORMATION_TEMPLATES[unit]?.[0]?.key || '');
                  setFormationModalState({
                    isOpen: true,
                    mode: 'add',
                    unit,
                  });
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 border border-indigo-500/80 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  + Formation
                </span>
              </button>

              {/* Playbook Tools Dropdown */}
              <div className="relative" ref={actionsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPlaybookActionsDropdownOpen(!isPlaybookActionsDropdownOpen)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isPlaybookActionsDropdownOpen
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white border-slate-300 dark:border-slate-500 ring-2 ring-indigo-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  title="Playbook tools and options"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" />
                  <span>Actions</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPlaybookActionsDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-amber-300' : 'text-slate-400'}`} />
                </button>

                {isPlaybookActionsDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl p-2 z-[100] animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10 dark:ring-white/10 space-y-1 origin-top-right">
                    <div className="px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                      Playbook &amp; Depth Chart Actions
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaybookActionsDropdownOpen(false);
                        setIsReorderModalOpen(true);
                      }}
                      className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div>Reorder Formations</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          Move formations up or down in order
                        </div>
                      </div>
                    </button>

                    {onOpenCopyWeekModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          onOpenCopyWeekModal();
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                          <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <div>Copy Week Lineup...</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Copy formations or player spots to any week</div>
                        </div>
                      </button>
                    )}

                    {teams.length > 1 && onCopyFormationsFromTeam && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          setShowCopyModal(true);
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-amber-400/20 border border-indigo-200 dark:border-amber-400/30 flex items-center justify-center shrink-0">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div>Clone from Team...</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Import formations from another team</div>
                        </div>
                      </button>
                    )}

                    {onOpenImportModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          onOpenImportModal();
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div>Upload / Restore Backup...</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Restore depth charts &amp; game plans from backup JSON</div>
                        </div>
                      </button>
                    )}

                    {onRestoreDefaultFormations && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          onRestoreDefaultFormations(unit);
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shrink-0">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div>Restore Default {unit === 'offense' ? 'Offensive' : unit === 'defense' ? 'Defensive' : unit === 'st' ? 'ST' : ''} Formations</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Re-populate standard formations &amp; unhide deleted</div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaybookActionsDropdownOpen(false);
                        setIsPocketPrintModalOpen(true);
                      }}
                      className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-amber-400/20 border border-indigo-200 dark:border-amber-400/30 flex items-center justify-center shrink-0">
                        <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div>Print Pocket Depth Chart</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Laminated pocket card layout &amp; 2-deep</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaybookActionsDropdownOpen(false);
                        onOpenSelectivePrintModal(unit);
                      }}
                      className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-amber-400/20 border border-indigo-200 dark:border-amber-400/30 flex items-center justify-center shrink-0">
                        <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div>Selective Print Sheets</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Choose specific formations to print</div>
                      </div>
                    </button>

                    {!isLockedByOther && !isHeldByMe && onAcquireLock && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          onAcquireLock();
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div>Lock Playbook for Me</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Prevent edits from other coaches</div>
                        </div>
                      </button>
                    )}

                    {isHeldByMe && onReleaseLock && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlaybookActionsDropdownOpen(false);
                          onReleaseLock();
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/90 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                          <Unlock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <div>Release Lock</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Allow other coaches to edit</div>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pocket Depth Chart Print Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedPocketPrintFormId(null);
              setIsPocketPrintModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-750 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Print Pocket Depth Chart in Laminated Card Format"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Pocket Card</span>
            <span className="sm:hidden">Pocket</span>
          </button>

          <button
            onClick={() => {
              setSelectedFormationPrintId(null);
              setIsFormationPrintModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-750 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Print Depth Chart Formations with Options (Depth, Highlighting, Page Breaks)"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Title Header (Shown only on Print) */}
      <div className="hidden print:block mb-2 border-b-2 border-black pb-1.5 text-center">
        <h1 className="font-black text-sm uppercase text-black tracking-wider">
          {teamDisplayName} &bull;{' '}
          {unit === 'offense'
            ? 'Offensive'
            : unit === 'defense'
            ? 'Defensive'
            : unit === 'st'
            ? 'Special Teams'
            : 'Depth Chart'}{' '}
          Formation Sheets
        </h1>
        <p className="text-[10px] font-bold text-black mt-0.5">
          High-Visibility Sideline Depth Chart &bull; Black &bull; Gold &bull; Blue &bull; Backups (White)
        </p>
      </div>

      {displayedFormations.length === 0 && (
        <div className="bg-slate-800/90 rounded-3xl border border-dashed border-slate-700 p-10 text-center text-slate-400 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl">
            🏈
          </div>
          <div>
            <p className="text-base font-bold text-slate-100">
              No {unit === 'offense' ? 'offensive' : unit === 'defense' ? 'defensive' : unit === 'st' ? 'special teams' : ''} formations found
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Restore the standard base formations for this unit, import your formations from a backup file, or create custom schemes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onRestoreDefaultFormations && (
              <button
                type="button"
                onClick={() => onRestoreDefaultFormations(unit)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                Restore Default {unit === 'offense' ? 'Offensive' : unit === 'defense' ? 'Defensive' : unit === 'st' ? 'Special Teams' : ''} Formations
              </button>
            )}
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <UploadCloud className="w-4 h-4" />
                Upload / Restore Backup...
              </button>
            )}
            {userRole === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setFormationNameInput('');
                  setFormationTemplateKey(FORMATION_TEMPLATES[unit]?.[0]?.key || '');
                  setFormationModalState({
                    isOpen: true,
                    mode: 'add',
                    unit,
                  });
                }}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Custom Formation
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
         MERGED MOBILE DEPTH VIEW (Pocket Laminated Table #5 + Player Assignment Matrix #3)
         ========================================================================= */}
      {viewMode === 'mobile_cards' && (
        <div className="space-y-4 print:hidden">
          {/* Sub-View Switcher: Pocket Table vs Player Matrix */}
          <div className="flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 p-1.5 rounded-2xl shadow-xs dark:shadow-xl">
            <button
              type="button"
              onClick={() => setMobileSubTab('pocket_chart')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mobileSubTab === 'pocket_chart'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>Pocket Depth Card</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileSubTab('player_matrix')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mobileSubTab === 'player_matrix'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Player Assignment Matrix</span>
            </button>
          </div>

          {/* Quick Universal Mobile Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                mobileSubTab === 'pocket_chart'
                  ? 'Filter by position (e.g. QB, LT, CB) or player name / jersey #...'
                  : 'Search player name, #, or assigned positions across formations...'
              }
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-xs dark:shadow-inner"
            />
            {mobileSearchQuery && (
              <button
                type="button"
                onClick={() => setMobileSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* =====================================================================
              SUB-TAB 1: POCKET LAMINATED CARD TABLE VIEW (#5)
             ===================================================================== */}
          {mobileSubTab === 'pocket_chart' && (
            <div className="space-y-4">
              {/* Formation Tab Selector Pills & Print Pocket Card Action */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveMobileFormationTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                      safeMobileTab === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs'
                    }`}
                  >
                    All Formations ({unitFormations.length})
                  </button>
                  {unitFormations.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveMobileFormationTab(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                        safeMobileTab === f.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPocketPrintFormId(
                      activeMobileFormationTab !== 'ALL' ? activeMobileFormationTab : null
                    );
                    setIsPocketPrintModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer print:hidden"
                  title="Print Pocket Depth Chart in Laminated Pocket Format"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pocket Card</span>
                </button>
              </div>

              {/* Formations List in Pocket Grid Format */}
              <div className="space-y-4">
                {mobileFormations.map((form) => {
                  const query = mobileSearchQuery.toLowerCase().trim();

                  // Collect all valid position slots in this formation
                  const allSlots: Array<{ pos: PositionSlot; rIdx: number; rowLabel: string }> = [];
                  form.rows.forEach((r, rIdx) => {
                    r.positions.forEach((p) => {
                      if (p) allSlots.push({ pos: p, rIdx, rowLabel: r.label || `Level ${rIdx + 1}` });
                    });
                  });

                  const filteredSlots = query
                    ? allSlots.filter(({ pos }) => {
                        if (pos.name.toLowerCase().includes(query)) return true;
                        const players = depthChart[pos.id] || [];
                        return players.some(
                          (pl) =>
                            pl.name.toLowerCase().includes(query) ||
                            pl.num.includes(query)
                        );
                      })
                    : allSlots;

                  if (query && filteredSlots.length === 0) return null;

                  return (
                    <div
                      key={form.id}
                      className="bg-white dark:bg-slate-850/95 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-sm dark:shadow-2xl overflow-hidden"
                    >
                      {/* Laminated Card Header */}
                      <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-850 dark:to-indigo-950/80 p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
                        {/* Title keeps its width on phones; the controls wrap onto the next line instead of squeezing it. */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-48">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            {unit === 'offense' ? 'OFF' : unit === 'defense' ? 'DEF' : unit === 'st' ? 'ST' : 'GRP'}
                          </div>
                          <div className="min-w-0">
                            <h2 className="font-black text-base text-slate-900 dark:text-white tracking-tight truncate">
                              {form.name}
                            </h2>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {filteredSlots.length} Positions • Pocket Depth Chart
                            </p>
                          </div>
                        </div>

                        {/* Laminated Card Header Controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPocketPrintFormId(form.id);
                              setIsPocketPrintModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-300 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-all shrink-0 print:hidden"
                            title={`Print ${form.name} Pocket Depth Card`}
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-amber-400" />
                          </button>

                          {userRole === 'admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRowLabelInput('');
                                  setRowLabelModalTarget({ formId: form.id, isNew: true });
                                }}
                                className="px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-600/30 dark:hover:bg-indigo-600/60 dark:text-indigo-200 dark:hover:text-white rounded-lg border border-indigo-200 dark:border-indigo-500/40 flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                title="Add Level to Formation"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Level</span>
                              </button>
                              {(() => {
                                const uIdx = unitFormations.findIndex((f) => f.id === form.id);
                                const isFirst = uIdx <= 0;
                                const isLast = uIdx === -1 || uIdx >= unitFormations.length - 1;
                                return (
                                  <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isFirst}
                                      onClick={() => onMoveFormation(form.id, -1)}
                                      title={isFirst ? 'Already at top' : 'Move formation up'}
                                      className={`p-1 rounded transition-all ${
                                        isFirst
                                          ? 'opacity-25 cursor-not-allowed text-slate-400'
                                          : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                                      }`}
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLast}
                                      onClick={() => onMoveFormation(form.id, 1)}
                                      title={isLast ? 'Already at bottom' : 'Move formation down'}
                                      className={`p-1 rounded transition-all ${
                                        isLast
                                          ? 'opacity-25 cursor-not-allowed text-slate-400'
                                          : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                                      }`}
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })()}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormationNameInput(`${form.name} (Copy)`);
                                  setFormationModalState({
                                    isOpen: true,
                                    mode: 'duplicate',
                                    formId: form.id,
                                    unit: form.unit,
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer shrink-0"
                                title="Duplicate formation"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                              type="button"
                              onClick={() => {
                                setFormationNameInput(form.name);
                                setFormationModalState({
                                  isOpen: true,
                                  mode: 'rename',
                                  formId: form.id,
                                  unit: form.unit,
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Rename formation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteFormationTarget({
                                  formId: form.id,
                                  formName: form.name,
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer shrink-0"
                              title="Delete formation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                      {/* Pocket Table Grid */}
                      <div className="overflow-x-auto divide-y divide-slate-200 dark:divide-slate-800/80">
                        {/* Table Header Bar */}
                        <div className="min-w-[490px] grid grid-cols-[48px_repeat(4,minmax(0,1fr))] bg-slate-100 dark:bg-slate-900/95 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 px-2 py-2 border-b border-slate-200 dark:border-slate-800 tracking-wider items-center gap-1.5">
                          <div className="text-left font-black text-slate-600 dark:text-slate-400">POS</div>
                          <div className="flex items-center gap-1 text-slate-900 dark:text-zinc-100 min-w-0 truncate">
                            <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-zinc-100 ring-1 ring-slate-400 dark:ring-zinc-600 shrink-0"></span>
                            <span className="truncate">BLACK</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 min-w-0 truncate font-black">
                            <span className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-500 shrink-0"></span>
                            <span className="truncate">GOLD</span>
                          </div>
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 min-w-0 truncate font-black">
                            <span className="w-2 h-2 rounded-full bg-blue-600 ring-1 ring-blue-500 shrink-0"></span>
                            <span className="truncate">BLUE</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 min-w-0 truncate">
                            <span className="w-2 h-2 rounded-full bg-slate-400 ring-1 ring-slate-400 dark:ring-slate-600 shrink-0"></span>
                            <span className="truncate">BACKUPS</span>
                          </div>
                        </div>

                        {/* Position Rows */}
                        {filteredSlots.map(({ pos, rIdx, rowLabel }) => {
                          const players = depthChart[pos.id] || [];
                          const blackPlayer = players[0];
                          const goldPlayer = players[1];
                          const bluePlayer = players[2];
                          const extraBackups = players.slice(3);

                          return (
                            <div
                              key={pos.id}
                              className="min-w-[490px] grid grid-cols-[48px_repeat(4,minmax(0,1fr))] px-2 py-2 items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* Position Badge (Clean without position description) */}
                              <div className="flex items-center justify-center min-w-0">
                                <span className="px-2 py-0.5 bg-indigo-600 text-white font-black text-[11px] rounded-md border border-indigo-400/40 shadow-xs leading-none">
                                  {pos.name}
                                </span>
                              </div>

                              {/* BLACK */}
                              <div className="min-w-0">
                                {blackPlayer ? (
                                  <div
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setQuickSwapTarget({
                                          posId: pos.id,
                                          posName: pos.name,
                                          formId: form.id,
                                          formName: form.name,
                                          currentIndex: 0,
                                          currentPlayer: blackPlayer,
                                        });
                                      }
                                    }}
                                    className="p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg flex items-center justify-between gap-1 shadow-xs cursor-pointer group transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-5 h-5 rounded bg-slate-900 text-white dark:bg-slate-950 dark:text-white border border-slate-850 dark:border-slate-700 font-mono font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                                        #{blackPlayer.num}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white tracking-tight truncate block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-tight">
                                          {blackPlayer.name}
                                        </span>
                                        <span className="text-[7.5px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block leading-none">
                                          BLACK
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setAssignPlayerModalTarget({
                                          formId: form.id,
                                          formName: form.name,
                                          posId: pos.id,
                                          posName: pos.name,
                                          targetIndex: 0,
                                        });
                                      }
                                    }}
                                    className="w-full py-1.5 px-1 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg text-center text-[10px] font-black text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-0.5 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3 text-slate-400 dark:text-slate-400 shrink-0" />
                                    <span className="truncate">+ BLACK</span>
                                  </button>
                                )}
                              </div>

                              {/* GOLD */}
                              <div className="min-w-0">
                                {goldPlayer ? (
                                  <div
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setQuickSwapTarget({
                                          posId: pos.id,
                                          posName: pos.name,
                                          formId: form.id,
                                          formName: form.name,
                                          currentIndex: 1,
                                          currentPlayer: goldPlayer,
                                        });
                                      }
                                    }}
                                    className="p-1 bg-white dark:bg-slate-900 border border-amber-400/80 dark:border-amber-500/50 hover:border-amber-500 rounded-lg flex items-center justify-between gap-1 shadow-xs cursor-pointer group transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-5 h-5 rounded bg-amber-400 text-slate-950 border border-amber-300 font-mono font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                                        #{goldPlayer.num}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white tracking-tight truncate block group-hover:text-amber-500 dark:group-hover:text-amber-400 leading-tight">
                                          {goldPlayer.name}
                                        </span>
                                        <span className="text-[7.5px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider block leading-none">
                                          GOLD
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setAssignPlayerModalTarget({
                                          formId: form.id,
                                          formName: form.name,
                                          posId: pos.id,
                                          posName: pos.name,
                                          targetIndex: 1,
                                        });
                                      }
                                    }}
                                    className="w-full py-1.5 px-1 border border-dashed border-amber-400/60 dark:border-amber-500/50 hover:border-amber-500 bg-amber-50/40 dark:bg-slate-900/60 hover:bg-amber-100/50 dark:hover:bg-slate-800/80 rounded-lg text-center text-[10px] font-black text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex items-center justify-center gap-0.5 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="truncate">+ GOLD</span>
                                  </button>
                                )}
                              </div>

                              {/* BLUE */}
                              <div className="min-w-0">
                                {bluePlayer ? (
                                  <div
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setQuickSwapTarget({
                                          posId: pos.id,
                                          posName: pos.name,
                                          formId: form.id,
                                          formName: form.name,
                                          currentIndex: 2,
                                          currentPlayer: bluePlayer,
                                        });
                                      }
                                    }}
                                    className="p-1 bg-white dark:bg-slate-900 border border-blue-400/80 dark:border-blue-500/50 hover:border-blue-500 rounded-lg flex items-center justify-between gap-1 shadow-xs cursor-pointer group transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="w-5 h-5 rounded bg-blue-600 text-white border border-blue-500 font-mono font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                                        #{bluePlayer.num}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white tracking-tight truncate block group-hover:text-blue-500 dark:group-hover:text-blue-400 leading-tight">
                                          {bluePlayer.name}
                                        </span>
                                        <span className="text-[7.5px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block leading-none">
                                          BLUE
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (userRole === 'admin') {
                                        setAssignPlayerModalTarget({
                                          formId: form.id,
                                          formName: form.name,
                                          posId: pos.id,
                                          posName: pos.name,
                                          targetIndex: 2,
                                        });
                                      }
                                    }}
                                    className="w-full py-1.5 px-1 border border-dashed border-blue-400/60 dark:border-blue-500/50 hover:border-blue-500 bg-blue-50/40 dark:bg-slate-900/60 hover:bg-blue-100/50 dark:hover:bg-slate-800/80 rounded-lg text-center text-[10px] font-black text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center justify-center gap-0.5 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="truncate">+ BLUE</span>
                                  </button>
                                )}
                              </div>

                              {/* BACKUPS (4th+ String) */}
                              <div className="min-w-0 flex items-center gap-1 flex-wrap">
                                {extraBackups.map((bk, bIdx) => {
                                  const realIdx = bIdx + 3;
                                  return (
                                    <button
                                      key={realIdx}
                                      type="button"
                                      onClick={() => {
                                        if (userRole === 'admin') {
                                          setQuickSwapTarget({
                                            posId: pos.id,
                                            posName: pos.name,
                                            formId: form.id,
                                            formName: form.name,
                                            currentIndex: realIdx,
                                            currentPlayer: bk,
                                          });
                                        }
                                      }}
                                      className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0 max-w-full"
                                      title={`Backup (D${realIdx + 1}): #${bk.num} ${bk.name}`}
                                    >
                                      <span className="font-mono font-black text-[9.5px] text-slate-900 dark:text-white">#{bk.num}</span>
                                      <span className="truncate max-w-[55px] font-extrabold text-slate-900 dark:text-white">{bk.name}</span>
                                    </button>
                                  );
                                })}

                                {userRole === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAssignPlayerModalTarget({
                                        formId: form.id,
                                        formName: form.name,
                                        posId: pos.id,
                                        posName: pos.name,
                                      });
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-md border border-slate-700/60 cursor-pointer shrink-0"
                                    title="Add Extra Backup Player"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              SUB-TAB 2: PLAYER ASSIGNMENT MATRIX VIEW (#3)
             ===================================================================== */}
          {mobileSubTab === 'player_matrix' && (
            <div className="space-y-4">
              {/* Matrix Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMatrixFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400 font-black'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  All Roster ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter('BLACK')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'BLACK' || matrixFilter === 'STARTERS'
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-950 font-black shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  BLACK ({playerAssignmentsMatrix.filter((p) => p.blackCount > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter('GOLD')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'GOLD'
                      ? 'bg-amber-400 text-slate-950 border border-amber-500 font-black shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  GOLD ({playerAssignmentsMatrix.filter((p) => p.goldCount > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter('BLUE')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'BLUE'
                      ? 'bg-blue-600 text-white border border-blue-500 font-black shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  BLUE ({playerAssignmentsMatrix.filter((p) => p.blueCount > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter('BACKUPS')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'BACKUPS' || matrixFilter === 'ROTATION'
                      ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  Backups ({playerAssignmentsMatrix.filter((p) => p.backupCount > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixFilter('UNASSIGNED')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                    matrixFilter === 'UNASSIGNED'
                      ? 'bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100 font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-slate-400 hover:text-rose-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  Unassigned in {unit.toUpperCase()} ({playerAssignmentsMatrix.filter((p) => p.isUnassigned).length})
                </button>
              </div>

              {/* Roster Assignment List */}
              <div className="space-y-3">
                {filteredMatrixPlayers.map((item) => {
                  return (
                    <div
                      key={item.player.id || `${item.num}-${item.playerName}`}
                      className="bg-white dark:bg-slate-850/95 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xs dark:shadow-md space-y-2.5"
                    >
                      {/* Player Info Line */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 border ${
                              item.blackCount > 0
                                ? 'bg-slate-900 text-white dark:bg-black dark:text-white border-slate-700 dark:border-zinc-600 shadow-xs'
                                : item.goldCount > 0
                                ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-xs'
                                : item.blueCount > 0
                                ? 'bg-blue-600 text-white border-blue-500 font-black shadow-xs'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            #{item.num}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-tight truncate">
                              {item.playerName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                              {item.player.primaryPosition && (
                                <span className="text-slate-700 dark:text-slate-300">
                                  Pos: {item.player.primaryPosition}
                                </span>
                              )}
                              {item.player.offensivePosition && (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  OFF: {item.player.offensivePosition}
                                </span>
                              )}
                              {item.player.defensivePosition && (
                                <span className="text-sky-700 dark:text-blue-400">
                                  DEF: {item.player.defensivePosition}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Summary Badges */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {item.blackCount > 0 && (
                            <span className="px-2 py-0.5 bg-slate-900 text-white dark:bg-black dark:text-white border border-slate-700 dark:border-zinc-700 font-black text-[10.5px] rounded-lg shadow-xs">
                              {item.blackCount} BLACK
                            </span>
                          )}
                          {item.goldCount > 0 && (
                            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 border border-amber-500 font-black text-[10.5px] rounded-lg shadow-xs">
                              {item.goldCount} GOLD
                            </span>
                          )}
                          {item.blueCount > 0 && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white border border-blue-500 font-black text-[10.5px] rounded-lg shadow-xs">
                              {item.blueCount} BLUE
                            </span>
                          )}
                          {item.backupCount > 0 && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[10.5px] rounded-lg">
                              {item.backupCount} Backup
                            </span>
                          )}
                          {item.isUnassigned && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-bold text-[10.5px] rounded-lg">
                              No Spot Yet
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Formation Assignments Badges */}
                      {item.assignments.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200 dark:border-slate-800/80">
                          {item.assignments.map((asgn, aIdx) => (
                            <div
                              key={aIdx}
                              className={`px-2.5 py-1 rounded-xl border text-xs font-black flex items-center gap-1.5 ${
                                asgn.depthIndex === 0
                                  ? 'bg-slate-900 border-slate-700 text-zinc-100 dark:bg-black/90 dark:border-zinc-700 dark:text-zinc-100 shadow-xs'
                                  : asgn.depthIndex === 1
                                  ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-500/60 text-slate-900 dark:text-white shadow-xs'
                                  : asgn.depthIndex === 2
                                  ? 'bg-white dark:bg-slate-900 border-blue-400 dark:border-blue-500/60 text-slate-900 dark:text-white shadow-xs'
                                  : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="font-extrabold text-slate-500 dark:text-slate-400">{asgn.formName}:</span>
                              <span className="text-slate-900 dark:text-white">{asgn.posName}</span>
                              <span
                                className={`text-[9.5px] px-1.5 py-0.5 rounded font-black uppercase ${
                                  asgn.depthIndex === 0
                                    ? 'bg-zinc-200 text-slate-950'
                                    : asgn.depthIndex === 1
                                    ? 'bg-amber-400 text-slate-950'
                                    : asgn.depthIndex === 2
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-200'
                                }`}
                              >
                                {asgn.stringLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 font-medium italic pt-1 border-t border-slate-800/60">
                          Player has not been assigned to any formation positions in {unit.toUpperCase()}.
                        </p>
                      )}
                    </div>
                  );
                })}

                {filteredMatrixPlayers.length === 0 && (
                  <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-300">No players match the current filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
         TACTICAL FIELD DIAGRAM VIEW (Grid Layout for Wide Screens & Printing)
         ========================================================================= */}
      <div className={`space-y-6 print:space-y-0 print:block ${viewMode === 'mobile_cards' ? 'hidden print:block' : 'block'}`}>
        {/* Mobile Swipe Tip when in field view */}
        <div className="md:hidden flex items-center justify-between gap-2 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-xs font-bold text-indigo-200 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">Viewing Field Diagram. Swipe sideways across rows.</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('mobile_cards')}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] rounded-xl shrink-0 whitespace-nowrap cursor-pointer shadow-xs"
          >
            Mobile View
          </button>
        </div>

        {unitFormations.map((form) => {
          const isFilterMatch = safeFilterViewId === 'ALL' || form.id === safeFilterViewId;
          const isSelected = selectedFormationId === form.id;

          return (
            <div
              key={form.id}
              data-form-id={form.id}
              onClick={() => onSelectFormation(form.id)}
              className={`formation-container bg-slate-800/90 backdrop-blur-md rounded-3xl border transition-all p-5 relative shadow-xl print:block print:w-full print:clear-both print:break-after-page [&:last-child]:print:break-after-auto ${
                !isFilterMatch ? 'hidden print:block' : ''
              } ${
                isSelected
                  ? 'border-indigo-500/80 shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                  : 'border-slate-700/80 hover:border-slate-600'
              }`}
            >
              {/* Formation Card Header */}
              <div className="formation-card-header flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-700/80 mb-4 print:pb-2 print:mb-3">
                <div className="flex items-center gap-3">
                  <div className="formation-unit-badge w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-xs print:w-7 print:h-7 print:bg-black print:text-amber-400 print:border-black print:text-xs print:font-black print:rounded-md">
                    {unit === 'offense'
                      ? 'OFF'
                      : unit === 'defense'
                      ? 'DEF'
                      : unit === 'st'
                      ? 'ST'
                      : 'GRP'}
                  </div>
                  <h2 className="font-black text-base md:text-lg text-slate-100 tracking-tight print:text-black print:text-xl print:font-black print:tracking-wider">
                    {form.name}
                  </h2>
                </div>

                {/* Admin Controls for Formation */}
                {userRole === 'admin' && (
                  <div
                    className="flex items-center gap-1.5 flex-wrap print:hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const uIdx = unitFormations.findIndex((f) => f.id === form.id);
                      const isFirst = uIdx <= 0;
                      const isLast = uIdx === -1 || uIdx >= unitFormations.length - 1;
                      return (
                        <div className="flex items-center bg-slate-900 border border-slate-750 rounded-xl p-0.5 shadow-xs">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => onMoveFormation(form.id, -1)}
                            title={isFirst ? 'Already at top' : 'Move Formation Up'}
                            className={`p-1 rounded-lg text-xs transition-all ${
                              isFirst
                                ? 'opacity-25 cursor-not-allowed text-slate-500'
                                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer'
                            }`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => onMoveFormation(form.id, 1)}
                            title={isLast ? 'Already at bottom' : 'Move Formation Down'}
                            className={`p-1 rounded-lg text-xs transition-all ${
                              isLast
                                ? 'opacity-25 cursor-not-allowed text-slate-500'
                                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800 cursor-pointer'
                            }`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => {
                        setRowLabelInput('Secondary Level');
                        setRowLabelModalTarget({
                          formId: form.id,
                          isNew: true,
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-750 rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-indigo-400" />
                      <span>Add Row</span>
                    </button>
                    <button
                      onClick={() => {
                        setFormationNameInput(`${form.name} (Copy)`);
                        setFormationModalState({
                          isOpen: true,
                          mode: 'duplicate',
                          formId: form.id,
                          unit: form.unit,
                        });
                      }}
                      title="Duplicate formation"
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border border-slate-750 rounded-xl transition-all cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setFormationNameInput(form.name);
                        setFormationModalState({
                          isOpen: true,
                          mode: 'rename',
                          formId: form.id,
                          unit: form.unit,
                        });
                      }}
                      title="Rename formation"
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border border-slate-750 rounded-xl transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFormationPrintId(form.id);
                        setIsFormationPrintModalOpen(true);
                      }}
                      title={`Print ${form.name} Depth Chart`}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-750 rounded-xl transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setDeleteFormationTarget({
                          formId: form.id,
                          formName: form.name,
                        });
                      }}
                      title="Delete formation"
                      className="p-1.5 text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/30 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Rows inside Formation */}
              <div className="space-y-4 print:space-y-2">
                {((form && Array.isArray(form.rows)) ? form.rows : []).map((row, rIdx) => {
                  const positionsList = (row && Array.isArray(row.positions)) ? row.positions : [];
                  const slotCount = positionsList.length || row?.slotCount || 7;

                  return (
                    <div key={row?.id || rIdx} className="space-y-2 print:space-y-1">
                      {/* Level/Row Header Bar */}
                      <div className="formation-row-header flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border border-slate-700 rounded-2xl shadow-inner">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (userRole === 'admin') {
                              setRowLabelInput(row?.label || `Level ${rIdx + 1}`);
                              setRowLabelModalTarget({
                                formId: form.id,
                                rIdx,
                                currentLabel: row?.label,
                                isNew: false,
                              });
                            }
                          }}
                          className={`text-[11px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5 print:text-black ${
                            userRole === 'admin'
                              ? 'cursor-pointer hover:text-indigo-300 group transition-colors'
                              : ''
                          }`}
                        >
                          <span>{row?.label || `Level ${rIdx + 1}`}</span>
                          {userRole === 'admin' && (
                            <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors print:hidden" />
                          )}
                        </div>

                        {/* Row Level Action Buttons & Slot Steppers */}
                        {userRole === 'admin' && (
                          <div
                            className="flex items-center gap-1.5 print:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Add Position Button */}
                            <button
                              onClick={() => {
                                const emptyIdx = positionsList.indexOf(null);
                                setCustomPosInput('');
                                setPositionPickerTarget({
                                  formId: form.id,
                                  rIdx,
                                  pIdx: emptyIdx !== -1 ? emptyIdx : positionsList.length,
                                  isEdit: false,
                                });
                              }}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3 h-3 text-emerald-400" />
                              <span>+ Pos</span>
                            </button>

                            {/* Quick Slot Stepper Controls: [ - ] [ Slots (N) ] [ + ] */}
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 shadow-xs">
                              <button
                                onClick={() => handleQuickRemoveSlot(form.id, rIdx, positionsList.length)}
                                disabled={positionsList.length <= 1}
                                title="Remove 1 slot from row"
                                className="px-1.5 py-0.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <button
                                onClick={() => {
                                  setRowSlotsCountInput(positionsList.length);
                                  setRowSlotsModalTarget({
                                    formId: form.id,
                                    rIdx,
                                    currentSlots: positionsList.length,
                                    rowLabel: row?.label || `Row ${rIdx + 1}`,
                                  });
                                }}
                                title="Configure number of slots (1 to 12)"
                                className="px-2 py-0.5 text-[10.5px] font-black text-indigo-300 hover:text-white hover:bg-indigo-600/30 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Settings2 className="w-2.5 h-2.5 text-indigo-400" />
                                <span>{positionsList.length} Slots</span>
                              </button>

                              <button
                                onClick={() => handleQuickAddSlot(form.id, rIdx, positionsList.length)}
                                disabled={positionsList.length >= 12}
                                title="Add 1 slot to row"
                                className="px-1.5 py-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Delete Row Button */}
                            <button
                              onClick={() => onDeleteRow(form.id, rIdx)}
                              title="Delete Row"
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Formation Grid Row */}
                      <div
                        className="formation-grid-row grid gap-2.5 p-3 bg-slate-900/60 border border-slate-700/80 rounded-2xl overflow-x-auto print:overflow-visible print:p-1.5 print:gap-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                        style={{
                          gridTemplateColumns: `repeat(${slotCount}, minmax(115px, 1fr))`,
                        }}
                      >
                        {positionsList.map((pos, pIdx) => {
                          const slotKey = `${form.id}_${rIdx}_${pIdx}`;
                          const isSlotDragOver = dragOverSlotKey === slotKey;

                          return (
                            <div
                              key={pIdx}
                              onDragOver={(e) => {
                                if (userRole === 'admin') {
                                  e.preventDefault();
                                  setDragOverSlotKey(slotKey);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverSlotKey === slotKey) setDragOverSlotKey(null);
                              }}
                              onDrop={(e) => {
                                if (userRole === 'admin') {
                                  setDragOverSlotKey(null);
                                  onPositionCardDropOnSlot(e, form.id, rIdx, pIdx);
                                }
                              }}
                              className={`position-slot-card min-h-[115px] print:min-h-[55px] rounded-2xl flex flex-col transition-all relative ${
                                isSlotDragOver
                                  ? 'bg-indigo-950/60 border-2 border-dashed border-indigo-400 ring-2 ring-indigo-500/40'
                                  : pos
                                  ? 'bg-slate-850/90 bg-slate-800/90'
                                  : 'bg-slate-900/40 border border-dashed border-slate-700/60 hover:border-indigo-500/60 hover:bg-indigo-950/20 position-slot-empty'
                              }`}
                            >
                              {pos ? (
                                <div
                                  onDragOver={(e) => {
                                    if (userRole === 'admin') {
                                      e.preventDefault();
                                      setDragOverPosId(pos.id);
                                    }
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverPosId === pos.id) setDragOverPosId(null);
                                  }}
                                  onDrop={(e) => {
                                    if (userRole === 'admin') {
                                      setDragOverPosId(null);
                                      onDropPlayerOnCard(pos.id, form.id, row.id);
                                    }
                                  }}
                                  className={`group/pos h-full flex flex-col rounded-2xl print:rounded-none border transition-all ${
                                    dragOverPosId === pos.id
                                      ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-950/40 shadow-lg'
                                      : 'border-slate-700 shadow-sm'
                                  }`}
                                >
                                  {/* Card Header (Position Name + Actions) */}
                                  <div
                                    draggable={userRole === 'admin'}
                                    onDragStart={(e) => {
                                      onPositionCardDragStart(e, form.id, rIdx, pIdx);
                                    }}
                                    className={`position-card-title px-2.5 py-1.5 bg-slate-900 border-b border-slate-700 rounded-t-2xl print:rounded-none flex items-center justify-between text-xs font-black select-none ${
                                      userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : ''
                                    }`}
                                  >
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (userRole === 'admin') {
                                          setCustomPosInput(pos.name);
                                          setPositionPickerTarget({
                                            formId: form.id,
                                            rIdx,
                                            pIdx,
                                            currentName: pos.name,
                                            isEdit: true,
                                          });
                                        }
                                      }}
                                      className={`flex items-center gap-1 truncate ${
                                        userRole === 'admin'
                                          ? 'hover:text-indigo-400 cursor-pointer'
                                          : ''
                                      }`}
                                    >
                                      <span className="font-black text-[11px] print:text-[11px] text-indigo-300 print:text-black tracking-tight">
                                        {pos.name}
                                      </span>
                                      {userRole === 'admin' && (
                                        <Edit2 className="w-2.5 h-2.5 text-slate-500 hover:text-indigo-400 print:hidden" />
                                      )}
                                    </div>

                                    {/* Position Header Actions */}
                                    {userRole === 'admin' && (
                                      <div
                                        className="flex items-center gap-0.5 shrink-0 print:hidden [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover/pos:flex [@media(hover:hover)]:group-focus-within/pos:flex"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => {
                                            if (onInsertSlotAt) {
                                              onInsertSlotAt(form.id, rIdx, pIdx);
                                            } else {
                                              handleQuickAddSlot(form.id, rIdx, positionsList.length);
                                            }
                                          }}
                                          title="Insert empty slot to the left (←)"
                                          className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 cursor-pointer"
                                        >
                                          <ArrowLeft className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (onInsertSlotAt) {
                                              onInsertSlotAt(form.id, rIdx, pIdx + 1);
                                            } else {
                                              handleQuickAddSlot(form.id, rIdx, positionsList.length);
                                            }
                                          }}
                                          title="Insert empty slot to the right (→)"
                                          className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 cursor-pointer"
                                        >
                                          <ArrowRight className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (onClearPositionToEmpty) {
                                              onClearPositionToEmpty(form.id, rIdx, pIdx);
                                            } else {
                                              onDeletePosition(form.id, rIdx, pIdx);
                                            }
                                          }}
                                          title="Clear position name (make this slot empty for spacing)"
                                          className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 cursor-pointer"
                                        >
                                          <Eraser className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedTargetRowIdx(
                                              rIdx === 0 && form.rows.length > 1 ? 1 : 0
                                            );
                                            setMovePositionTarget({
                                              formId: form.id,
                                              rIdx,
                                              pIdx,
                                              posName: pos.name,
                                            });
                                          }}
                                          title="Move position to another row"
                                          className="p-1 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-800 cursor-pointer"
                                        >
                                          <Move className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            const other = formations.find((f) => f.id !== form.id);
                                            setSelectedTargetFormId(other?.id || '');
                                            setCopyPositionTarget({
                                              formId: form.id,
                                              rIdx,
                                              pIdx,
                                              posName: pos.name,
                                            });
                                          }}
                                          title="Copy position to another formation"
                                          className="p-1 text-slate-400 hover:text-indigo-400 rounded hover:bg-slate-800 cursor-pointer"
                                        >
                                          <Copy className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (onRemoveSlotFromRow) {
                                              onRemoveSlotFromRow(form.id, rIdx, pIdx);
                                            } else {
                                              onDeletePosition(form.id, rIdx, pIdx);
                                            }
                                          }}
                                          title="Delete slot completely from row"
                                          className="p-1 text-slate-400 hover:text-rose-300 rounded hover:bg-rose-950/40 cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Player List on this Position Card */}
                                  <div className="p-2 print:p-1 flex-1 flex flex-col gap-1.5 print:gap-1 min-h-[64px] print:min-h-[40px]">
                                    {(depthChart[pos.id] || []).map((player, plIdx) => {
                                      const isStarter = plIdx === 0;
                                      const isD2 = plIdx === 1;
                                      const isD3 = plIdx === 2;

                                      return (
                                        <div
                                          key={plIdx}
                                          draggable={userRole === 'admin'}
                                          onDragStart={(e) => {
                                            onDragStartPlacedPlayer(e, pos.id, plIdx, player);
                                          }}
                                          className={`px-2 py-1 print:px-1.5 print:py-0.5 rounded-xl print:rounded-sm border text-[10.5px] print:text-[10px] font-black flex items-center justify-between transition-all select-none print:min-h-[20px] ${
                                            isStarter
                                              ? 'bg-black text-white border-zinc-700 shadow-xs print-player-badge-starter'
                                              : isD2
                                              ? 'bg-amber-400 text-slate-950 border-amber-500 font-extrabold shadow-xs print-player-badge-d2'
                                              : isD3
                                              ? 'bg-blue-600 text-white border-blue-500 font-extrabold shadow-xs print-player-badge-d3'
                                              : 'bg-white text-slate-950 border-slate-300 font-extrabold shadow-xs print-player-badge-d4'
                                          } ${userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            <span
                                              className={`text-[8.5px] print:text-[8.5px] font-black uppercase px-1 py-0.2 rounded-md shrink-0 ${
                                                isStarter
                                                  ? 'bg-zinc-800 text-white border border-zinc-700 print-tag-st'
                                                  : isD2
                                                  ? 'bg-black/20 text-black print-tag-d2'
                                                  : isD3
                                                  ? 'bg-white/20 text-white print-tag-d3'
                                                  : 'bg-slate-200 text-slate-900 border border-slate-300 print-tag-d4'
                                              }`}
                                            >
                                              {isStarter ? 'ST' : isD2 ? 'D2' : isD3 ? 'D3' : `D${plIdx + 1}`}
                                            </span>
                                            <span className="font-mono text-[10px] print:text-[10.5px] opacity-90 font-black shrink-0">
                                              #{player.num}
                                            </span>
                                            <span className="uppercase font-black text-[10.5px] sm:text-[11px] print:text-[10px] tracking-tight leading-tight break-words flex-1 line-clamp-2">
                                              {player.name}
                                            </span>
                                          </div>

                                          {userRole === 'admin' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onRemovePlayerFromCard(pos.id, plIdx);
                                              }}
                                              className={`ml-1 opacity-70 hover:opacity-100 print:hidden text-xs cursor-pointer ${
                                                isStarter
                                                  ? 'text-zinc-400 hover:text-rose-400'
                                                  : isD2
                                                  ? 'text-slate-900 hover:text-rose-700'
                                                  : isD3
                                                  ? 'text-white hover:text-rose-300'
                                                  : 'text-slate-700 hover:text-rose-600'
                                              }`}
                                            >
                                              &times;
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {(!depthChart[pos.id] || depthChart[pos.id].length === 0) && (
                                      <div className="flex-1 flex items-center justify-center text-[10px] text-slate-500 font-medium italic border border-dashed border-slate-800 rounded-xl print:rounded-none p-2 print:p-0.5 print:border-none">
                                        <span className="print:hidden">Open</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Interactive Empty Slot (Hidden in Print) */
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (userRole === 'admin') {
                                      setCustomPosInput('');
                                      setPositionPickerTarget({
                                        formId: form.id,
                                        rIdx,
                                        pIdx,
                                        isEdit: false,
                                      });
                                    }
                                  }}
                                  className={`flex-1 flex flex-col items-center justify-between p-2.5 text-center transition-all print:hidden ${
                                    userRole === 'admin'
                                      ? 'cursor-pointer hover:bg-indigo-950/30 group'
                                      : ''
                                  }`}
                                >
                                  {/* Top label / slot indicator */}
                                  <div className="w-full flex items-center justify-between text-[8.5px] font-bold text-slate-400">
                                    <span>Empty Slot #{pIdx + 1}</span>
                                    <span className="opacity-0 group-hover:opacity-100 text-indigo-400 font-bold transition-opacity">
                                      + Pos
                                    </span>
                                  </div>

                                  {/* Center Add Position Icon */}
                                  <div className="my-1.5 flex flex-col items-center">
                                    <div className="w-7 h-7 rounded-xl bg-slate-800/80 border border-slate-700/80 group-hover:border-indigo-500/60 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-300 flex items-center justify-center transition-all shadow-inner">
                                      <Plus className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 group-hover:text-indigo-300 mt-1 transition-colors">
                                      + Position
                                    </span>
                                  </div>

                                  {/* Bottom Slot Action Bar */}
                                  {userRole === 'admin' && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full flex items-center justify-center gap-1.5 pt-1 border-t border-slate-800/80 opacity-60 group-hover:opacity-100 transition-opacity"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onInsertSlotAt) {
                                            onInsertSlotAt(form.id, rIdx, pIdx);
                                          } else {
                                            handleQuickAddSlot(form.id, rIdx, positionsList.length);
                                          }
                                        }}
                                        title="Insert empty slot left (←)"
                                        className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all text-[9px] flex items-center gap-0.5"
                                      >
                                        <ArrowLeft className="w-2.5 h-2.5" />
                                        <span className="text-[8px] font-bold">Slot</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onInsertSlotAt) {
                                            onInsertSlotAt(form.id, rIdx, pIdx + 1);
                                          } else {
                                            handleQuickAddSlot(form.id, rIdx, positionsList.length);
                                          }
                                        }}
                                        title="Insert empty slot right (→)"
                                        className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all text-[9px] flex items-center gap-0.5"
                                      >
                                        <span className="text-[8px] font-bold">Slot</span>
                                        <ArrowRight className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onRemoveSlotFromRow) {
                                            onRemoveSlotFromRow(form.id, rIdx, pIdx);
                                          } else {
                                            handleQuickRemoveSlot(form.id, rIdx, positionsList.length);
                                          }
                                        }}
                                        title="Delete this empty slot"
                                        className="p-1 rounded-md bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all text-[9px]"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
         1. POSITION PICKER & BUILDER MODAL (In-App Dialog)
         ========================================================================= */}
      {positionPickerTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  {positionPickerTarget.isEdit ? 'Rename Position Slot' : 'Assign / Create Position'}
                </h3>
              </div>
              <button
                onClick={() => setPositionPickerTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300">
                Position Label:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPosInput}
                  onChange={(e) => setCustomPosInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customPosInput.trim()) {
                      const val = customPosInput.trim();
                      if (positionPickerTarget.isEdit) {
                        if (onRenamePositionDirect) {
                          onRenamePositionDirect(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            positionPickerTarget.pIdx,
                            val
                          );
                        } else if (onEditPositionName) {
                          onEditPositionName(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            positionPickerTarget.pIdx
                          );
                        }
                      } else {
                        if (onAssignPositionToSlot) {
                          onAssignPositionToSlot(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            positionPickerTarget.pIdx,
                            val
                          );
                        } else if (onAddPositionDirect) {
                          onAddPositionDirect(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            val
                          );
                        }
                      }
                      setPositionPickerTarget(null);
                    }
                  }}
                  placeholder="e.g. QB, MLB, LT, Gunner..."
                  autoFocus
                  className="flex-1 bg-slate-850 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    if (!customPosInput.trim()) return;
                    const val = customPosInput.trim();
                    if (positionPickerTarget.isEdit) {
                      if (onRenamePositionDirect) {
                        onRenamePositionDirect(
                          positionPickerTarget.formId,
                          positionPickerTarget.rIdx,
                          positionPickerTarget.pIdx,
                          val
                        );
                      }
                    } else {
                      if (onAssignPositionToSlot) {
                        onAssignPositionToSlot(
                          positionPickerTarget.formId,
                          positionPickerTarget.rIdx,
                          positionPickerTarget.pIdx,
                          val
                        );
                      } else if (onAddPositionDirect) {
                        onAddPositionDirect(
                          positionPickerTarget.formId,
                          positionPickerTarget.rIdx,
                          val
                        );
                      }
                    }
                    setPositionPickerTarget(null);
                  }}
                  disabled={!customPosInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Quick Football Position Preset Badges */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-400">
                ⚡ Quick Select Standard Positions:
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                {activePresetTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (positionPickerTarget.isEdit) {
                        if (onRenamePositionDirect) {
                          onRenamePositionDirect(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            positionPickerTarget.pIdx,
                            tag
                          );
                        }
                      } else {
                        if (onAssignPositionToSlot) {
                          onAssignPositionToSlot(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            positionPickerTarget.pIdx,
                            tag
                          );
                        } else if (onAddPositionDirect) {
                          onAddPositionDirect(
                            positionPickerTarget.formId,
                            positionPickerTarget.rIdx,
                            tag
                          );
                        }
                      }
                      setPositionPickerTarget(null);
                    }}
                    className="px-2.5 py-1.5 bg-slate-850 hover:bg-indigo-600 hover:text-white border border-slate-700/80 rounded-xl text-xs font-black text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onClearPositionToEmpty) {
                      onClearPositionToEmpty(
                        positionPickerTarget.formId,
                        positionPickerTarget.rIdx,
                        positionPickerTarget.pIdx
                      );
                    } else if (onRemoveSlotFromRow) {
                      onRemoveSlotFromRow(
                        positionPickerTarget.formId,
                        positionPickerTarget.rIdx,
                        positionPickerTarget.pIdx
                      );
                    }
                    setPositionPickerTarget(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-amber-500/30"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Make Slot Empty</span>
                </button>

                <button
                  onClick={() => {
                    if (onRemoveSlotFromRow) {
                      onRemoveSlotFromRow(
                        positionPickerTarget.formId,
                        positionPickerTarget.rIdx,
                        positionPickerTarget.pIdx
                      );
                    } else {
                      handleQuickRemoveSlot(
                        positionPickerTarget.formId,
                        positionPickerTarget.rIdx,
                        positionPickerTarget.pIdx + 1
                      );
                    }
                    setPositionPickerTarget(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer border border-rose-500/30"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Delete Slot</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPositionPickerTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         2. ROW SLOTS CONFIG MODAL
         ========================================================================= */}
      {rowSlotsModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  Configure Row Slot Count
                </h3>
              </div>
              <button
                onClick={() => setRowSlotsModalTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-300 font-medium">
                Set how many position slots are rendered in row{' '}
                <strong className="text-indigo-300">"{rowSlotsModalTarget.rowLabel}"</strong>.
              </p>
            </div>

            {/* Stepper Control */}
            <div className="flex items-center justify-center gap-4 py-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <button
                onClick={() => setRowSlotsCountInput((prev) => Math.max(1, prev - 1))}
                disabled={rowSlotsCountInput <= 1}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-lg flex items-center justify-center cursor-pointer shadow-md"
              >
                -
              </button>
              <div className="text-center px-4">
                <span className="text-3xl font-black text-white font-mono">
                  {rowSlotsCountInput}
                </span>
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Slots (1 to 12)
                </span>
              </div>
              <button
                onClick={() => setRowSlotsCountInput((prev) => Math.min(12, prev + 1))}
                disabled={rowSlotsCountInput >= 12}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-lg flex items-center justify-center cursor-pointer shadow-md"
              >
                +
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-slate-400">
                Common Grid Presets:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[3, 5, 7, 9, 11].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setRowSlotsCountInput(cnt)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      rowSlotsCountInput === cnt
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {cnt} Slots
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setRowSlotsModalTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDirectSetSlots(
                    rowSlotsModalTarget.formId,
                    rowSlotsModalTarget.rIdx,
                    rowSlotsCountInput
                  );
                  setRowSlotsModalTarget(null);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply Slots ({rowSlotsCountInput})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         3. ROW LABEL / ADD ROW MODAL
         ========================================================================= */}
      {rowLabelModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  {rowLabelModalTarget.isNew ? 'Add New Row Level' : 'Rename Row Level'}
                </h3>
              </div>
              <button
                onClick={() => setRowLabelModalTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-slate-300">
                Row Label / Header:
              </label>
              <input
                type="text"
                value={rowLabelInput}
                onChange={(e) => setRowLabelInput(e.target.value)}
                placeholder="e.g. Backfield, Linebackers, Secondary..."
                autoFocus
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase text-indigo-400">
                Preset Suggestions:
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                {ROW_PRESET_LABELS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setRowLabelInput(preset)}
                    className="px-2.5 py-1 bg-slate-850 hover:bg-indigo-600 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setRowLabelModalTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rowLabelInput.trim()) return;
                  const label = rowLabelInput.trim();
                  if (rowLabelModalTarget.isNew) {
                    if (onAddRowDirect) {
                      onAddRowDirect(rowLabelModalTarget.formId, label, 7);
                    } else if (onAddRow) {
                      onAddRow(rowLabelModalTarget.formId);
                    }
                  } else if (typeof rowLabelModalTarget.rIdx === 'number') {
                    if (onRenameRowDirect) {
                      onRenameRowDirect(
                        rowLabelModalTarget.formId,
                        rowLabelModalTarget.rIdx,
                        label
                      );
                    } else if (onEditRowName) {
                      onEditRowName(rowLabelModalTarget.formId, rowLabelModalTarget.rIdx);
                    }
                  }
                  setRowLabelModalTarget(null);
                }}
                disabled={!rowLabelInput.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{rowLabelModalTarget.isNew ? 'Create Row' : 'Save Name'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         4. FORMATION BUILDER / RENAME / DUPLICATE MODAL
         ========================================================================= */}
      {formationModalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  {formationModalState.mode === 'add'
                    ? `Create ${formationModalState.unit.toUpperCase()} Formation`
                    : formationModalState.mode === 'rename'
                    ? 'Rename Formation'
                    : 'Duplicate Formation'}
                </h3>
              </div>
              <button
                onClick={() => setFormationModalState((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-slate-300">
                Formation Name:
              </label>
              <input
                type="text"
                value={formationNameInput}
                onChange={(e) => setFormationNameInput(e.target.value)}
                placeholder="e.g. 11 Shotgun / 4-4 Base Defense / Punt..."
                autoFocus
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Template selector when adding */}
            {formationModalState.mode === 'add' && FORMATION_TEMPLATES[formationModalState.unit] && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  ⚡ Choose Preset Football Template (Optional):
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {FORMATION_TEMPLATES[formationModalState.unit].map((tpl) => (
                    <div
                      key={tpl.key}
                      onClick={() => {
                        setFormationTemplateKey(tpl.key);
                        if (!formationNameInput) {
                          setFormationNameInput(tpl.label.split('(')[0].trim());
                        }
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        formationTemplateKey === tpl.key
                          ? 'bg-indigo-600/20 border-indigo-500/80 ring-1 ring-indigo-500'
                          : 'bg-slate-850/80 hover:bg-slate-800 border-slate-700/80'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-slate-100 block">
                          {tpl.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {tpl.desc}
                        </span>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 ${
                          formationTemplateKey === tpl.key ? 'text-indigo-400' : 'text-slate-600'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setFormationModalState((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!formationNameInput.trim()) return;
                  const name = formationNameInput.trim();

                  if (formationModalState.mode === 'add') {
                    if (onAddFormationDirect) {
                      onAddFormationDirect(formationModalState.unit, name, formationTemplateKey);
                    } else if (onAddFormation) {
                      onAddFormation(formationModalState.unit);
                    }
                  } else if (formationModalState.mode === 'rename' && formationModalState.formId) {
                    if (onRenameFormationDirect) {
                      onRenameFormationDirect(formationModalState.formId, name);
                    } else if (onRenameFormation) {
                      onRenameFormation(formationModalState.formId);
                    }
                  } else if (formationModalState.mode === 'duplicate' && formationModalState.formId) {
                    if (onDuplicateFormationDirect) {
                      onDuplicateFormationDirect(formationModalState.formId, name);
                    } else if (onDuplicateFormation) {
                      onDuplicateFormation(formationModalState.formId);
                    }
                  }

                  setFormationModalState((prev) => ({ ...prev, isOpen: false }));
                }}
                disabled={!formationNameInput.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {formationModalState.mode === 'add'
                    ? 'Create Formation'
                    : formationModalState.mode === 'rename'
                    ? 'Save Name'
                    : 'Duplicate'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         5. MOVE POSITION MODAL
         ========================================================================= */}
      {movePositionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Move className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  Move [{movePositionTarget.posName}] to Another Row
                </h3>
              </div>
              <button
                onClick={() => setMovePositionTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select destination row level inside this formation:
            </p>

            <div className="space-y-2">
              {formations
                .find((f) => f.id === movePositionTarget.formId)
                ?.rows.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    onClick={() => setSelectedTargetRowIdx(idx)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedTargetRowIdx === idx
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black text-white block">
                        {r.label || `Level ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {r.positions.filter(Boolean).length} of {r.positions.length} slots filled
                      </span>
                    </div>
                    {selectedTargetRowIdx === idx && (
                      <Check className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setMovePositionTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onMovePositionDirect) {
                    onMovePositionDirect(
                      movePositionTarget.formId,
                      movePositionTarget.rIdx,
                      movePositionTarget.pIdx,
                      selectedTargetRowIdx
                    );
                  } else if (onMovePositionRow) {
                    onMovePositionRow(
                      movePositionTarget.formId,
                      movePositionTarget.rIdx,
                      movePositionTarget.pIdx
                    );
                  }
                  setMovePositionTarget(null);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Move Position</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         6. COPY POSITION MODAL
         ========================================================================= */}
      {copyPositionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-slate-100">
                  Copy [{copyPositionTarget.posName}] to Another Formation
                </h3>
              </div>
              <button
                onClick={() => setCopyPositionTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select destination formation to duplicate this position tag and depth assignments:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {formations
                .filter((f) => f.id !== copyPositionTarget.formId)
                .map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedTargetFormId(f.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedTargetFormId === f.id
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black text-white block">{f.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">
                        Unit: {f.unit} &bull; {f.rows.length} rows
                      </span>
                    </div>
                    {selectedTargetFormId === f.id && (
                      <Check className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setCopyPositionTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedTargetFormId) {
                    if (onCopyPositionDirect) {
                      onCopyPositionDirect(
                        copyPositionTarget.formId,
                        copyPositionTarget.rIdx,
                        copyPositionTarget.pIdx,
                        selectedTargetFormId
                      );
                    } else if (onCopyPositionToOtherForm) {
                      onCopyPositionToOtherForm(
                        copyPositionTarget.formId,
                        copyPositionTarget.rIdx,
                        copyPositionTarget.pIdx
                      );
                    }
                  }
                  setCopyPositionTarget(null);
                }}
                disabled={!selectedTargetFormId}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Copy Position</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         7. CLONE FORMATIONS FROM TEAM MODAL
         ========================================================================= */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm text-slate-100">
                  Clone Formations from Team
                </h3>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Copy all offensive, defensive, and special teams formations from another team into{' '}
              <strong className="text-indigo-300">{activeTeam?.name || 'this team'}</strong>.
            </p>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                Source Team:
              </label>
              <select
                value={copySourceTeamId}
                onChange={(e) => setCopySourceTeamId(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {teams
                  .filter((t) => t.id !== activeTeam?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.ageGroup || 'Youth'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onCopyFormationsFromTeam && copySourceTeamId) {
                    onCopyFormationsFromTeam(copySourceTeamId);
                    setShowCopyModal(false);
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Clone Formations</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         8. MOBILE / DIRECT ASSIGN PLAYER MODAL
         ========================================================================= */}
      {assignPlayerModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-bottom-6 sm:zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-indigo-600 text-white font-black text-xs rounded-lg shadow-xs">
                    {assignPlayerModalTarget.posName}
                  </span>
                  <h3 className="font-black text-base text-white">
                    Assign Player to {assignPlayerModalTarget.posName}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                  <span>Formation: <span className="text-slate-200 font-bold">{assignPlayerModalTarget.formName}</span></span>
                  {assignPlayerModalTarget.targetIndex !== undefined && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-amber-400">
                        Slot:{' '}
                        {assignPlayerModalTarget.targetIndex === 0
                          ? 'BLACK'
                          : assignPlayerModalTarget.targetIndex === 1
                          ? 'GOLD'
                          : assignPlayerModalTarget.targetIndex === 2
                          ? 'BLUE'
                          : `BACKUP (D${assignPlayerModalTarget.targetIndex + 1})`}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignPlayerModalTarget(null);
                  setPlayerPickerSearch('');
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input & Filter Pills */}
            <div className="p-3 border-b border-slate-800 bg-slate-850/50 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search roster by name, jersey #, or pos..."
                  value={playerPickerSearch}
                  onChange={(e) => setPlayerPickerSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-inner"
                />
                {playerPickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPlayerPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setPlayerPickerPosFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    playerPickerPosFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Players ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerPickerPosFilter('MATCHING')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    playerPickerPosFilter === 'MATCHING'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Matching ({assignPlayerModalTarget.posName})
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerPickerPosFilter('UNASSIGNED')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    playerPickerPosFilter === 'UNASSIGNED'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unassigned in Formation
                </button>
              </div>
            </div>

            {/* Roster Players List */}
            <div className="p-3 overflow-y-auto max-h-[50vh] space-y-1.5 divide-y divide-slate-800/40">
              {filteredRosterPlayers.map((player) => {
                const playerName =
                  `${player.firstName || ''} ${player.lastName || ''}`.trim() ||
                  player.rosterName ||
                  'Player';

                // Check if player is already assigned in this position
                const currentPosPlayers = depthChart[assignPlayerModalTarget.posId] || [];
                const alreadyInThisPos = currentPosPlayers.some(
                  (p) => p.num.trim() === player.num.trim()
                );

                return (
                  <div
                    key={player.id || `${player.num}-${playerName}`}
                    onClick={() => {
                      const playerObj: PlacedPlayer = {
                        name: playerName,
                        num: player.num,
                      };
                      if (onAssignPlayerDirect) {
                        onAssignPlayerDirect(
                          assignPlayerModalTarget.posId,
                          playerObj,
                          assignPlayerModalTarget.targetIndex
                        );
                      } else {
                        onDropPlayerOnCard(
                          assignPlayerModalTarget.posId,
                          assignPlayerModalTarget.formId,
                          ''
                        );
                      }
                      setAssignPlayerModalTarget(null);
                      setPlayerPickerSearch('');
                    }}
                    className="pt-2 flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-800/90 border border-transparent hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 font-mono font-black text-sm flex items-center justify-center border border-slate-700 text-amber-400 shrink-0 group-hover:border-indigo-500 shadow-xs">
                        #{player.num}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-indigo-300">
                          {playerName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold mt-0.5">
                          {player.primaryPosition && (
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                              {player.primaryPosition}
                            </span>
                          )}
                          {player.offensivePosition && (
                            <span className="px-1.5 py-0.2 bg-emerald-950/80 text-emerald-300 rounded border border-emerald-800/40">
                              OFF: {player.offensivePosition}
                            </span>
                          )}
                          {player.defensivePosition && (
                            <span className="px-1.5 py-0.2 bg-blue-950/80 text-blue-300 rounded border border-blue-800/40">
                              DEF: {player.defensivePosition}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alreadyInThisPos ? (
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded-xl">
                          In Position
                        </span>
                      ) : (
                        <span className="text-xs font-black text-indigo-400 group-hover:text-white group-hover:bg-indigo-600 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1 shadow-xs">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Assign</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRosterPlayers.length === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <p className="text-xs font-bold text-slate-300">No players match your search filter.</p>
                  <p className="text-[11px] text-slate-500">Try searching for a different name, number, or clearing the filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         QUICK SWAP & PLAYER ACTIONS MODAL (Mobile Sideline Optimization)
         ========================================================================= */}
      {quickSwapTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col space-y-4 p-5 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  {quickSwapTarget.formName} • {quickSwapTarget.posName}
                </span>
                <h3 className="font-black text-base text-white">Player Depth Options</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickSwapTarget(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Player Card */}
            <div className="p-3 bg-black/60 border border-zinc-700 rounded-2xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 border ${
                    quickSwapTarget.currentIndex === 0
                      ? 'bg-slate-900 text-white border-slate-700'
                      : quickSwapTarget.currentIndex === 1
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                      : quickSwapTarget.currentIndex === 2
                      ? 'bg-blue-600 text-white border-blue-400 font-black'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  #{quickSwapTarget.currentPlayer.num}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase text-white truncate">
                    {quickSwapTarget.currentPlayer.name}
                  </div>
                  <span
                    className={`text-[10.5px] font-black uppercase tracking-wider ${
                      quickSwapTarget.currentIndex === 0
                        ? 'text-slate-300'
                        : quickSwapTarget.currentIndex === 1
                        ? 'text-amber-400'
                        : quickSwapTarget.currentIndex === 2
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {quickSwapTarget.currentIndex === 0
                      ? 'BLACK'
                      : quickSwapTarget.currentIndex === 1
                      ? 'GOLD'
                      : quickSwapTarget.currentIndex === 2
                      ? 'BLUE'
                      : `BACKUP (D${quickSwapTarget.currentIndex + 1})`}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const target = quickSwapTarget;
                  setQuickSwapTarget(null);
                  setAssignPlayerModalTarget({
                    formId: target.formId,
                    formName: target.formName,
                    posId: target.posId,
                    posName: target.posName,
                    targetIndex: target.currentIndex,
                  });
                }}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Replace with Another Player</span>
              </button>

              {/* Order Controls */}
              <div className="grid grid-cols-2 gap-2">
                {quickSwapTarget.currentIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onReorderDepthPlayer) {
                        onReorderDepthPlayer(
                           quickSwapTarget.posId,
                          quickSwapTarget.currentIndex,
                          quickSwapTarget.currentIndex - 1
                        );
                      }
                      setQuickSwapTarget(null);
                    }}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4 text-emerald-400" />
                    <span>Promote / Move Up</span>
                  </button>
                ) : (
                  <div className="py-2 px-3 bg-slate-900 text-slate-600 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1.5">
                    <span className="text-[11px]">Already Black</span>
                  </div>
                )}

                {(depthChart[quickSwapTarget.posId]?.length || 0) > quickSwapTarget.currentIndex + 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onReorderDepthPlayer) {
                        onReorderDepthPlayer(
                          quickSwapTarget.posId,
                          quickSwapTarget.currentIndex,
                          quickSwapTarget.currentIndex + 1
                        );
                      }
                      setQuickSwapTarget(null);
                    }}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 text-amber-400" />
                    <span>Demote / Move Down</span>
                  </button>
                ) : (
                  <div className="py-2 px-3 bg-slate-900 text-slate-600 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1.5">
                    <span className="text-[11px]">Lowest Tier</span>
                  </div>
                )}
              </div>

              {/* Remove Action */}
              <button
                type="button"
                onClick={() => {
                  onRemovePlayerFromCard(quickSwapTarget.posId, quickSwapTarget.currentIndex);
                  setQuickSwapTarget(null);
                }}
                className="w-full py-2 px-3 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove From Position</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated In-App Delete Formation Confirmation Modal */}
      {deleteFormationTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col space-y-4 p-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-base text-white">Delete Formation</h3>
                <p className="text-xs font-bold text-slate-400 truncate">
                  Delete <span className="text-rose-300 font-black">"{deleteFormationTarget.formName}"</span>?
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800 leading-relaxed">
              This will remove the formation and unassign its position slots for this team.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteFormationTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = deleteFormationTarget.formId;
                  setDeleteFormationTarget(null);
                  if (activeMobileFormationTab === idToDelete) {
                    setActiveMobileFormationTab('ALL');
                  }
                  if (filterViewId === idToDelete) {
                    setFilterViewId('ALL');
                  }
                  onDeleteFormation(idToDelete);
                }}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Formation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Reorder Formations Modal */}
      {isReorderModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsReorderModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Reorder Formations
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {unit.toUpperCase()} UNIT ({unitFormations.length} Formations)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {unitFormations.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No {unit} formations found.
                </div>
              ) : (
                unitFormations.map((form, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === unitFormations.length - 1;
                  return (
                    <div
                      key={form.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-black shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {form.name}
                          </div>
                          {form.subtitle && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {form.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => onMoveFormation(form.id, -1)}
                          title={isFirst ? 'Already at top' : 'Move Up'}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            isFirst
                              ? 'opacity-25 cursor-not-allowed text-slate-400 bg-transparent'
                              : 'bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-600/30 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 shadow-xs cursor-pointer'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[10px]">Up</span>
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => onMoveFormation(form.id, 1)}
                          title={isLast ? 'Already at bottom' : 'Move Down'}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            isLast
                              ? 'opacity-25 cursor-not-allowed text-slate-400 bg-transparent'
                              : 'bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-600/30 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 shadow-xs cursor-pointer'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[10px]">Down</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md cursor-pointer transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Dedicated Pocket Depth Chart Print Modal */}
      {isPocketPrintModalOpen && (
        <PocketDepthChartPrintModal
          isOpen={isPocketPrintModalOpen}
          onClose={() => {
            setIsPocketPrintModalOpen(false);
            setSelectedPocketPrintFormId(null);
          }}
          formations={formations}
          depthChart={depthChart}
          activeUnit={unit}
          activeTeamName={activeTeam?.name || 'Football Manager'}
          initialSelectedFormationId={selectedPocketPrintFormId}
        />
      )}

      {/* Dedicated Tactical Field Formation Depth Chart Print Modal */}
      {isFormationPrintModalOpen && (
        <FormationDepthChartPrintModal
          isOpen={isFormationPrintModalOpen}
          onClose={() => {
            setIsFormationPrintModalOpen(false);
            setSelectedFormationPrintId(null);
          }}
          formations={formations}
          depthChart={depthChart}
          activeUnit={unit}
          activeTeamName={activeTeam?.name || 'Football Manager'}
          initialSelectedFormationId={selectedFormationPrintId}
        />
      )}
    </div>
  );
};
