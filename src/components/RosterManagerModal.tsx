import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UserPlus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  Shield,
  Zap,
  Download,
  Upload,
  Search,
  AlertTriangle,
  Sparkles,
  Users,
  Copy,
  FileText,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { RosterPlayer, UserRole, Team, FormationBoard, PlacedPlayer } from '../types';
import { MASTER_ROSTER } from '../data/initialData';
import {
  getPlayerPositionsFromDepthChart,
  syncRosterPositionsFromDepthChart,
  cleanTruncatedPosition,
} from '../utils/depthChartUtils';

interface RosterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  onUpdateRoster: (newRoster: RosterPlayer[]) => void;
  userRole: UserRole;
  editingPlayer?: RosterPlayer | null;
  onClearEditingPlayer?: () => void;
  teams?: Team[];
  activeTeamId?: string;
  formations?: FormationBoard[];
  depthChart?: Record<string, PlacedPlayer[]>;
}

const COMMON_POSITIONS = [
  'QB', 'RB', 'FB', 'TB', 'WR', 'TE', 'X', 'Z', 'W', 'Y',
  'LT', 'LG', 'C', 'RG', 'RT', 'OL',
  'DE', 'DT', 'NT', 'MLB', 'OLB', 'ILB', 'M', 'S', 'R',
  'CB', 'FS', 'SS', 'LCB', 'RCB', 'DB',
  'K', 'P', 'LS', 'H', 'RET', 'ATH'
];

export const RosterManagerModal: React.FC<RosterManagerModalProps> = ({
  isOpen,
  onClose,
  roster,
  onUpdateRoster,
  userRole,
  editingPlayer: initialEditingPlayer,
  onClearEditingPlayer,
  teams = [],
  activeTeamId,
  formations = [],
  depthChart = {},
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'csv' | 'copy'>('list');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>(activeTeamId || 'all');

  // Form State for Add / Edit
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [num, setNum] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rosterName, setRosterName] = useState('');
  const [isRosterNameCustomized, setIsRosterNameCustomized] = useState(false);
  const [assignedTeamId, setAssignedTeamId] = useState<string>(activeTeamId || (teams[0]?.id || ''));
  const [primaryPos, setPrimaryPos] = useState('RB');
  const [secondaryPos, setSecondaryPos] = useState('CB');
  const [offensivePos, setOffensivePos] = useState('');
  const [defensivePos, setDefensivePos] = useState('');
  const [conditioningHours, setConditioningHours] = useState<number>(10);
  const [paddedHours, setPaddedHours] = useState<number>(10);
  const [isCaptain, setIsCaptain] = useState(false);
  const [notes, setNotes] = useState('');
  const [csvText, setCsvText] = useState('');
  const [formError, setFormError] = useState('');
  const [csvPreviewPlayers, setCsvPreviewPlayers] = useState<RosterPlayer[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<'replace' | 'append'>('replace');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy Team Roster State
  const [copySourceTeamId, setCopySourceTeamId] = useState<string>(teams[0]?.id || '');
  const [copyTargetTeamId, setCopyTargetTeamId] = useState<string>(activeTeamId || (teams[1]?.id || ''));

  // Compute depth chart derived positions for every player
  const depthChartPositionsMap = useMemo(() => {
    return getPlayerPositionsFromDepthChart(formations, depthChart);
  }, [formations, depthChart]);

  // Sync selected team filter if activeTeamId changes
  React.useEffect(() => {
    if (activeTeamId) {
      setSelectedTeamFilter(activeTeamId);
      setAssignedTeamId(activeTeamId);
    }
  }, [activeTeamId]);

  // Handle opening directly in edit mode if editingPlayer prop is provided
  React.useEffect(() => {
    if (initialEditingPlayer) {
      const idx = roster.findIndex(
        (p) =>
          p.num === initialEditingPlayer.num &&
          (!initialEditingPlayer.teamId || p.teamId === initialEditingPlayer.teamId)
      );
      if (idx >= 0) {
        startEditPlayer(initialEditingPlayer, idx);
      }
    }
  }, [initialEditingPlayer]);

  if (!isOpen) return null;

  const startAddPlayer = () => {
    setEditingIndex(null);
    setNum('');
    setFirstName('');
    setLastName('');
    setRosterName('');
    setIsRosterNameCustomized(false);
    const targetTeam = selectedTeamFilter !== 'all' ? selectedTeamFilter : activeTeamId || (teams[0]?.id || '');
    setAssignedTeamId(targetTeam);
    setPrimaryPos('RB');
    setSecondaryPos('CB');
    setOffensivePos('');
    setDefensivePos('');
    setConditioningHours(10);
    setPaddedHours(10);
    setIsCaptain(false);
    setNotes('');
    setFormError('');
    setActiveTab('add');
  };

  const startEditPlayer = (player: RosterPlayer, idx: number) => {
    setEditingIndex(idx);
    setNum(player.num);
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setRosterName(player.rosterName || player.lastName || '');
    setIsRosterNameCustomized(Boolean(player.rosterName && player.rosterName !== player.lastName));
    setAssignedTeamId(player.teamId || activeTeamId || (teams[0]?.id || ''));
    setPrimaryPos(player.primaryPosition || 'RB');
    setSecondaryPos(player.secondaryPosition || 'CB');
    setOffensivePos(player.offensivePosition || '');
    setDefensivePos(player.defensivePosition || '');
    setConditioningHours(Number(player.conditioningHours || 10));
    setPaddedHours(Number(player.paddedHours || 10));
    setIsCaptain(!!player.isCaptain);
    setNotes(player.notes || '');
    setFormError('');
    setActiveTab('add');
  };

  // Helper to apply detected depth chart positions into Add/Edit form (truncated, pure position codes)
  const applyDepthChartToForm = (playerNumToLookup: string) => {
    const derived = depthChartPositionsMap.get(playerNumToLookup.trim());
    if (derived) {
      if (derived.cleanPrimary) setPrimaryPos(derived.cleanPrimary);
      else if (derived.suggestedPrimary) setPrimaryPos(cleanTruncatedPosition(derived.suggestedPrimary));

      if (derived.cleanSecondary) setSecondaryPos(derived.cleanSecondary);
      else if (derived.suggestedSecondary) setSecondaryPos(cleanTruncatedPosition(derived.suggestedSecondary));

      if (derived.primaryOffense) setOffensivePos(cleanTruncatedPosition(derived.primaryOffense));
      if (derived.primaryDefense) setDefensivePos(cleanTruncatedPosition(derived.primaryDefense));
    }
  };

  // Quick apply clean truncated depth chart positions to a single player on the roster
  const handleApplySinglePlayerPositions = (player: RosterPlayer) => {
    const derived = depthChartPositionsMap.get(player.num.trim());
    if (!derived || !derived.truncatedPositions || derived.truncatedPositions.length === 0) return;

    const newOff = cleanTruncatedPosition(derived.primaryOffense || '') || derived.cleanPrimary || player.offensivePosition || player.primaryPosition;
    const newDef = cleanTruncatedPosition(derived.primaryDefense || '') || derived.cleanSecondary || player.defensivePosition || player.secondaryPosition;
    const newPrimary = derived.cleanPrimary || cleanTruncatedPosition(player.primaryPosition);
    const newSecondary = derived.cleanSecondary || cleanTruncatedPosition(player.secondaryPosition);

    const updated = roster.map((p) => {
      if (p.num === player.num && (!player.teamId || p.teamId === player.teamId)) {
        return {
          ...p,
          primaryPosition: newPrimary,
          secondaryPosition: newSecondary,
          offensivePosition: newOff,
          defensivePosition: newDef,
        };
      }
      return p;
    });

    onUpdateRoster(updated);
  };

  // Bulk add positions from Depth Charts for the team (pure position codes, no numbers or formations)
  const handleBulkSyncFromDepthCharts = () => {
    const targetTeam = selectedTeamFilter !== 'all' ? selectedTeamFilter : activeTeamId || teams[0]?.id;
    const targetTeamName = teams.find((t) => t.id === targetTeam)?.name || 'active team';

    const { updatedRoster, countUpdated } = syncRosterPositionsFromDepthChart(
      roster,
      formations,
      depthChart,
      { targetTeamId: selectedTeamFilter }
    );

    if (countUpdated === 0) {
      alert(`All player positions already match the active Depth Charts on ${targetTeamName}!`);
      return;
    }

    if (
      confirm(
        `Add positions from active Depth Charts for ${countUpdated} players on ${targetTeamName}? Positions will be truncated to pure position codes (e.g. QB, RB, CB, DE) with no numbers or formations.`
      )
    ) {
      onUpdateRoster(updatedRoster);
      alert(`Successfully added depth chart positions to ${countUpdated} players!`);
    }
  };

  const handleSavePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!num.trim()) {
      setFormError('Jersey number is required');
      return;
    }
    if (!firstName.trim()) {
      setFormError('First name is required');
      return;
    }

    const cleanNum = num.trim().replace(/\D/g, '');
    if (!cleanNum) {
      setFormError('Jersey number must contain digits');
      return;
    }

    // Check duplicate jersey number if adding or changing within same team
    const duplicate = roster.some(
      (p, i) =>
        p.num === cleanNum &&
        i !== editingIndex &&
        (p.teamId === assignedTeamId || (!p.teamId && assignedTeamId === (teams[0]?.id || 'team_10u')))
    );
    if (duplicate) {
      const targetTeamName = teams.find((t) => t.id === assignedTeamId)?.name || 'this team';
      setFormError(`Jersey #${cleanNum} is already assigned on ${targetTeamName}.`);
      return;
    }

    const finalRosterName = (rosterName.trim() || lastName.trim() || firstName.trim()).trim();

    const newPlayer: RosterPlayer = {
      num: cleanNum,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      rosterName: finalRosterName,
      teamId: assignedTeamId || undefined,
      primaryPosition: primaryPos,
      secondaryPosition: secondaryPos,
      offensivePosition: offensivePos.trim() || primaryPos,
      defensivePosition: defensivePos.trim() || secondaryPos,
      conditioningHours: Math.min(10, Math.max(0, Number(conditioningHours) || 0)),
      paddedHours: Math.min(10, Math.max(0, Number(paddedHours) || 0)),
      isCaptain,
      notes: notes.trim(),
    };

    let updated: RosterPlayer[];
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < roster.length) {
      updated = [...roster];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...newPlayer,
      };
    } else {
      updated = [...roster, newPlayer];
    }

    // Sort roster by jersey number
    updated.sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));

    onUpdateRoster(updated);
    if (onClearEditingPlayer) onClearEditingPlayer();
    setActiveTab('list');
  };

  const handleDeletePlayer = (playerToDelete: RosterPlayer) => {
    const teamName = teams.find((t) => t.id === playerToDelete.teamId)?.name || 'this team';
    if (
      !confirm(
        `Are you sure you want to remove #${playerToDelete.num} ${playerToDelete.firstName} ${playerToDelete.lastName} from ${teamName}?`
      )
    ) {
      return;
    }
    const updated = roster.filter(
      (p) =>
        !(
          p.num === playerToDelete.num &&
          (p.teamId === playerToDelete.teamId || (!p.teamId && !playerToDelete.teamId))
        )
    );
    onUpdateRoster(updated);
  };

  const handleClearRoster = () => {
    if (selectedTeamFilter !== 'all') {
      const targetTeam = teams.find((t) => t.id === selectedTeamFilter);
      const teamName = targetTeam ? targetTeam.name : selectedTeamFilter;
      if (
        confirm(
          `Are you sure you want to clear all players for ${teamName}? Players on other teams will remain intact.`
        )
      ) {
        const updated = roster.filter((p) => (p.teamId || teams[0]?.id) !== selectedTeamFilter);
        onUpdateRoster(updated);
      }
    } else {
      if (confirm('Are you sure you want to clear ALL players across ALL teams in the entire program?')) {
        onUpdateRoster([]);
      }
    }
  };

  // Copy Roster from One Team to Another
  const handleExecuteCopyRoster = () => {
    if (!copySourceTeamId || !copyTargetTeamId) return;
    if (copySourceTeamId === copyTargetTeamId) {
      alert('Please select two different teams to copy between.');
      return;
    }
    const sourcePlayers = roster.filter((p) => (p.teamId || teams[0]?.id) === copySourceTeamId);
    if (sourcePlayers.length === 0) {
      alert('Source team has no players to copy.');
      return;
    }

    const sourceTeam = teams.find((t) => t.id === copySourceTeamId);
    const targetTeam = teams.find((t) => t.id === copyTargetTeamId);

    if (
      !confirm(
        `Copy ${sourcePlayers.length} players from ${sourceTeam?.name || 'Source'} into ${targetTeam?.name || 'Target'}?`
      )
    ) {
      return;
    }

    // Keep other teams' players and non-duplicate target players
    const otherPlayers = roster.filter((p) => (p.teamId || teams[0]?.id) !== copyTargetTeamId);
    const clonedPlayers: RosterPlayer[] = sourcePlayers.map((p) => ({
      ...p,
      teamId: copyTargetTeamId,
    }));

    const updated = [...otherPlayers, ...clonedPlayers];
    updated.sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));
    onUpdateRoster(updated);
    setSelectedTeamFilter(copyTargetTeamId);
    setActiveTab('list');
    alert(`Successfully copied ${clonedPlayers.length} players to ${targetTeam?.name}!`);
  };

  // Robust CSV / Text Parsing Engine supporting headers, quotes, commas, tabs
  const parseCSVRawText = (rawContent: string, targetTeam: string): RosterPlayer[] => {
    const lines = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    // Helper to split a CSV line considering quotes
    const splitCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      const delimiter = line.includes('\t') ? '\t' : ',';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const firstLineCols = splitCSVLine(lines[0]).map((c) => c.toLowerCase().trim());
    const isHeaderRow =
      firstLineCols.some((c) =>
        ['jersey', 'number', '#', 'no', 'num', 'first', 'firstname', 'name', 'pos', 'position', 'offense', 'defense'].includes(c)
      );

    let colJersey = 0;
    let colFirst = 1;
    let colLast = 2;
    let colRosterName = -1;
    let colPrimary = 3;
    let colSecondary = 4;
    let colNotes = -1;
    let colCaptain = -1;
    let startIdx = 0;

    if (isHeaderRow) {
      startIdx = 1;
      firstLineCols.forEach((col, idx) => {
        if (['jersey', 'number', '#', 'no', 'num', 'jersey#', 'jersey_num'].includes(col)) colJersey = idx;
        else if (['first', 'firstname', 'first_name', 'f_name', 'player_name', 'name'].includes(col)) colFirst = idx;
        else if (['last', 'lastname', 'last_name', 'l_name'].includes(col)) colLast = idx;
        else if (['rostername', 'roster_name', 'roster name', 'displayname', 'display_name'].includes(col)) colRosterName = idx;
        else if (['pos', 'position', 'primary', 'primary_pos', 'primarypos', 'offense', 'off_pos'].includes(col)) colPrimary = idx;
        else if (['secondary', 'sec_pos', 'secondary_pos', 'defense', 'def_pos'].includes(col)) colSecondary = idx;
        else if (['note', 'notes', 'comments'].includes(col)) colNotes = idx;
        else if (['captain', 'is_captain', 'c'].includes(col)) colCaptain = idx;
      });
    }

    const parsed: RosterPlayer[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const parts = splitCSVLine(lines[i]);
      if (parts.length >= 2) {
        const rawNum = (parts[colJersey] || '').replace(/\D/g, '');
        let fName = parts[colFirst] || '';
        let lName = colLast >= 0 && colLast < parts.length ? parts[colLast] || '' : '';

        // If name was provided as single "First Last" in one column
        if (colFirst === colLast || (!lName && fName.includes(' '))) {
          const nameParts = fName.split(/\s+/);
          fName = nameParts[0] || '';
          lName = nameParts.slice(1).join(' ') || '';
        }

        const rName = colRosterName >= 0 && parts[colRosterName] ? parts[colRosterName].trim() : (lName || fName);
        const pPos = (parts[colPrimary] || 'ATH').toUpperCase();
        const sPos = (colSecondary >= 0 && parts[colSecondary] ? parts[colSecondary] : 'ATH').toUpperCase();
        const noteVal = colNotes >= 0 ? parts[colNotes] || '' : '';
        const captVal = colCaptain >= 0 ? ['true', 'yes', '1', 'c'].includes((parts[colCaptain] || '').toLowerCase()) : false;

        if (rawNum && fName) {
          parsed.push({
            num: rawNum,
            firstName: fName,
            lastName: lName,
            rosterName: rName,
            teamId: targetTeam,
            primaryPosition: pPos,
            secondaryPosition: sPos,
            offensivePosition: pPos,
            defensivePosition: sPos,
            conditioningHours: 10,
            paddedHours: 10,
            isCaptain: captVal,
            notes: noteVal,
          });
        }
      }
    }

    return parsed;
  };

  // File Upload Handler (via Drag/Drop or Browse)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setCsvText(content);
      const targetTeam = assignedTeamId || (selectedTeamFilter !== 'all' ? selectedTeamFilter : activeTeamId || teams[0]?.id);
      const players = parseCSVRawText(content, targetTeam);
      setCsvPreviewPlayers(players);
    };
    reader.readAsText(file);
  };

  // Textarea Change Handler
  const handleCsvTextChange = (text: string) => {
    setCsvText(text);
    const targetTeam = assignedTeamId || (selectedTeamFilter !== 'all' ? selectedTeamFilter : activeTeamId || teams[0]?.id);
    const players = parseCSVRawText(text, targetTeam);
    setCsvPreviewPlayers(players);
  };

  // Execute CSV Import
  const handleExecuteImportCSV = () => {
    const targetTeamId = assignedTeamId || (selectedTeamFilter !== 'all' ? selectedTeamFilter : activeTeamId || teams[0]?.id);
    const targetTeamName = teams.find((t) => t.id === targetTeamId)?.name || 'the team';

    const playersToImport = csvPreviewPlayers.length > 0
      ? csvPreviewPlayers
      : parseCSVRawText(csvText, targetTeamId);

    if (playersToImport.length === 0) {
      alert('No valid player records found. Please ensure format contains at least Jersey # and First Name.');
      return;
    }

    let updated: RosterPlayer[];
    if (csvImportMode === 'replace') {
      // Keep players from other teams, replace current team
      const otherTeams = roster.filter((p) => (p.teamId || teams[0]?.id) !== targetTeamId);
      updated = [...otherTeams, ...playersToImport];
    } else {
      // Append mode: merge, avoid exact duplicate jersey numbers on same team
      const otherPlayers = roster.filter(
        (p) => !(p.teamId === targetTeamId && playersToImport.some((imp) => imp.num === p.num))
      );
      updated = [...otherPlayers, ...playersToImport];
    }

    updated.sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));
    onUpdateRoster(updated);
    alert(`Successfully imported ${playersToImport.length} players to ${targetTeamName}!`);
    setActiveTab('list');
    setCsvText('');
    setCsvPreviewPlayers([]);
    setCsvFileName(null);
  };

  // CSV Export
  const handleExportCSV = () => {
    const header = 'Jersey,FirstName,LastName,RosterName,Team,PrimaryPos,SecondaryPos,Captain,Notes\n';
    const rows = filteredRoster
      .map((p) => {
        const teamName = teams.find((t) => t.id === p.teamId)?.name || 'Default';
        const rName = p.rosterName || p.lastName || p.firstName;
        return `${p.num},"${p.firstName}","${p.lastName}","${rName}","${teamName}","${p.primaryPosition || ''}","${
          p.secondaryPosition || ''
        }","${p.isCaptain ? 'Yes' : 'No'}","${p.notes || ''}"`;
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Roster_${selectedTeamFilter !== 'all' ? selectedTeamFilter : 'All_Teams'}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample Template CSV
  const handleDownloadSampleCSV = () => {
    const template = `Jersey,FirstName,LastName,RosterName,PrimaryPos,SecondaryPos,Captain,Notes
10,Alex,Smith,Smith,QB,FS,Yes,Team leader and play caller
2,Jordan,Taylor,Taylor,RB,CB,No,Fast outside runner
56,Sam,Johnson,Johnson,LT,DE,No,Strong run blocker
88,Marcus,Davis,M. Davis,WR,CB,No,Great hands
52,Ethan,Miller,Miller,C,MLB,Yes,Defensive captain
12,Lucas,Brown,Brown,TE,OLB,No,Physical blocker`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Roster_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRoster = roster.filter((p) => {
    if (selectedTeamFilter !== 'all') {
      const pTeam = p.teamId || teams[0]?.id || 'team_10u';
      if (pTeam !== selectedTeamFilter) {
        if (
          (pTeam === 'team_10u' || pTeam === 'team-10u') &&
          (selectedTeamFilter === 'team_10u' || selectedTeamFilter === 'team-10u')
        ) {
          // match
        } else {
          return false;
        }
      }
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.num.includes(term) ||
      p.firstName.toLowerCase().includes(term) ||
      p.lastName.toLowerCase().includes(term) ||
      (p.rosterName || '').toLowerCase().includes(term) ||
      (p.primaryPosition || '').toLowerCase().includes(term) ||
      (p.secondaryPosition || '').toLowerCase().includes(term)
    );
  });

  // Current editing player's depth chart position info
  const activeEditingPlayerDepthInfo = num ? depthChartPositionsMap.get(num.trim()) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                <span>Roster &amp; Player Management</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase">
                  {roster.length} Total Players
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Manage roster, CSV file import, and auto-assign positions from active depth charts
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (onClearEditingPlayer) onClearEditingPlayer();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Sub-Tabs & Team Filter */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Players ({roster.length})
            </button>
            {userRole === 'admin' && (
              <>
                <button
                  onClick={startAddPlayer}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'add' && editingIndex === null
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add New Player</span>
                </button>
                <button
                  onClick={() => setActiveTab('csv')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'csv'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>CSV File Import / Export</span>
                </button>
                {teams.length > 1 && (
                  <button
                    onClick={() => setActiveTab('copy')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'copy'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Copy Between Teams</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Team Filter Dropdown for list tab */}
          {activeTab === 'list' && teams.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[10px] font-black uppercase text-indigo-300 font-mono">Team View:</span>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="bg-slate-800 border border-indigo-500/40 text-slate-100 text-xs rounded-lg px-2.5 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Teams ({roster.length} players)</option>
                {teams.map((t) => {
                  const count = roster.filter((p) => {
                    const pTeam = p.teamId || teams[0]?.id || 'team_10u';
                    return (
                      pTeam === t.id ||
                      ((pTeam === 'team_10u' || pTeam === 'team-10u') &&
                        (t.id === 'team_10u' || t.id === 'team-10u'))
                    );
                  }).length;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({count} players)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {userRole === 'admin' && activeTab === 'list' && roster.length > 0 && (
            <button
              onClick={handleClearRoster}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-950/40 border border-rose-900/30 transition-all cursor-pointer"
              title="Clear all players from roster"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Roster</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {/* TAB 1: ALL PLAYERS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Toolbar with Depth Chart Sync and Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-850 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, jersey, or position..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {userRole === 'admin' && (
                    <button
                      onClick={handleBulkSyncFromDepthCharts}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 border border-indigo-400/40 transition-all cursor-pointer active:scale-95"
                      title="Add clean truncated positions from active depth charts onto roster (omits numbers and formations)"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>⚡ Add Positions from Depth Chart</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Player Name</th>
                      <th className="py-2.5 px-3">Roster / Position Name</th>
                      <th className="py-2.5 px-3">Team</th>
                      <th className="py-2.5 px-3">Offense Pos</th>
                      <th className="py-2.5 px-3">Defense Pos</th>
                      <th className="py-2.5 px-3">Depth Chart Positions</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {filteredRoster.map((player, idx) => {
                      const playerTeam = teams.find((t) => t.id === player.teamId);
                      const depthInfo = depthChartPositionsMap.get(player.num.trim());
                      const displayRosterName = player.rosterName || player.lastName || player.firstName;

                      return (
                        <tr key={`${player.num}-${idx}`} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black text-indigo-400">
                            #{player.num}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span>
                                {player.firstName} {player.lastName}
                              </span>
                              {player.isCaptain && (
                                <span
                                  title="Team Captain"
                                  className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]"
                                >
                                  C
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 font-mono font-bold text-[11px]" title="Display name in Depth Chart and Formations">
                              {displayRosterName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                              {playerTeam ? playerTeam.ageGroup || playerTeam.name : 'Assigned'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-indigo-500/30 font-black text-[10px]">
                              {player.primaryPosition || 'ATH'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-500/30 font-black text-[10px]">
                              {player.secondaryPosition || 'ATH'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {depthInfo && depthInfo.truncatedPositions && depthInfo.truncatedPositions.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {depthInfo.truncatedPositions.map((pos, pIdx) => (
                                  <span
                                    key={pIdx}
                                    title={`Position: ${pos}`}
                                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 font-mono shadow-2xs"
                                  >
                                    {pos}
                                  </span>
                                ))}
                                {userRole === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplySinglePlayerPositions(player)}
                                    title={`Add depth chart position (${depthInfo.truncatedPositions.join(', ')}) onto ${player.firstName}'s roster positions`}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                    <span>Add</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-[160px] truncate">
                            {player.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {userRole === 'admin' && (
                                <>
                                  <button
                                    onClick={() => startEditPlayer(player, idx)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                                    title="Edit player"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePlayer(player)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                                    title="Delete player"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRoster.length === 0 && (
                <div className="p-8 text-center bg-slate-850 rounded-2xl border border-slate-800 my-2">
                  <UserPlus className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-60" />
                  <h4 className="font-black text-sm text-slate-200 mb-1">
                    {roster.length === 0
                      ? 'No Players in Master Roster'
                      : selectedTeamFilter !== 'all'
                      ? `No Players Registered for ${teams.find((t) => t.id === selectedTeamFilter)?.name || 'Selected Team'}`
                      : 'No Matching Players Found'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    {roster.length === 0
                      ? 'Your program currently has no players on file. You can restore the standard 26-player roster, import a CSV, or add players individually.'
                      : selectedTeamFilter !== 'all'
                      ? 'You can copy the roster from another team, import a CSV file, or add new players directly.'
                      : 'Try adjusting your search criteria or clear the search filter.'}
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {roster.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateRoster(MASTER_ROSTER);
                          setSelectedTeamFilter('all');
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Restore Master 26-Player Roster</span>
                      </button>
                    )}
                    {selectedTeamFilter !== 'all' && roster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const sourceTeam = teams.find((t) => t.id !== selectedTeamFilter);
                          if (sourceTeam) {
                            setCopySourceTeamId(sourceTeam.id);
                            setCopyTargetTeamId(selectedTeamFilter);
                            setActiveTab('copy');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Users className="w-4 h-4 text-indigo-200" />
                        <span>Copy Players From Another Team</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={startAddPlayer}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Add Player</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD / EDIT PLAYER FORM */}
          {activeTab === 'add' && (
            <form onSubmit={handleSavePlayer} className="space-y-4 max-w-xl mx-auto">
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                  <h4 className="font-black text-sm text-slate-100">
                    {editingIndex !== null ? `Edit Player #${num}` : 'Add New Player to Roster'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Back to List
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Team Selection */}
                {teams.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                      Assigned Team / Division *
                    </label>
                    <select
                      value={assignedTeamId}
                      onChange={(e) => setAssignedTeamId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.ageGroup || 'Youth'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Jersey & Names */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                        Jersey # *
                      </label>
                      <input
                        type="text"
                        value={num}
                        onChange={(e) => setNum(e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFirstName(val);
                          if (!isRosterNameCustomized && !lastName.trim()) {
                            setRosterName(val);
                          }
                        }}
                        placeholder="Alex"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLastName(val);
                          if (!isRosterNameCustomized) {
                            setRosterName(val || firstName);
                          }
                        }}
                        placeholder="Smith"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Roster Name Field */}
                  <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-300">
                        Roster Name (Position / Depth Chart Display Name)
                      </label>
                      <span className="text-[9px] font-bold text-indigo-400/80">
                        Defaults to Last Name
                      </span>
                    </div>
                    <input
                      type="text"
                      value={rosterName}
                      onChange={(e) => {
                        setRosterName(e.target.value);
                        setIsRosterNameCustomized(true);
                      }}
                      placeholder={lastName || firstName || 'e.g. Smith or J. Smith'}
                      className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-600"
                    />
                    <p className="text-[10px] text-slate-400">
                      This is the name that appears when placing the player into positions on depth charts and formation spots.
                    </p>
                  </div>
                </div>

                {/* Depth Chart Position Detection Banner */}
                {activeEditingPlayerDepthInfo && activeEditingPlayerDepthInfo.truncatedPositions && activeEditingPlayerDepthInfo.truncatedPositions.length > 0 && (
                  <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Depth Chart Positions:</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeEditingPlayerDepthInfo.truncatedPositions.map((pos, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-mono"
                          >
                            {pos}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyDepthChartToForm(num)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg shadow-sm shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Add to Form</span>
                    </button>
                  </div>
                )}

                {/* Positions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                      Offense / Primary Position
                    </label>
                    <select
                      value={primaryPos}
                      onChange={(e) => setPrimaryPos(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {COMMON_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1">
                      Defense / Secondary Position
                    </label>
                    <select
                      value={secondaryPos}
                      onChange={(e) => setSecondaryPos(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {COMMON_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Captain toggle & Notes */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isCaptain}
                      onChange={(e) => setIsCaptain(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-amber-300">Team Captain Designation</span>
                  </label>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Player Notes
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Coaching notes, position preferences..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingIndex !== null ? 'Update Player' : 'Add Player to Roster'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CSV FILE & TEXT IMPORT */}
          {activeTab === 'csv' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h4 className="font-black text-sm text-slate-100">Import Roster from CSV File or Text</h4>
                      <p className="text-xs text-slate-400">
                        Upload a .csv / .tsv spreadsheet file or paste text directly
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-indigo-300 text-[11px] font-bold rounded-lg border border-indigo-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Download a formatted sample spreadsheet"
                  >
                    <Download className="w-3 h-3 text-indigo-400" />
                    <span>Sample CSV</span>
                  </button>
                </div>

                {/* Target Team & Mode Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Import Into Team:
                    </label>
                    <select
                      value={assignedTeamId}
                      onChange={(e) => {
                        setAssignedTeamId(e.target.value);
                        if (csvText) {
                          setCsvPreviewPlayers(parseCSVRawText(csvText, e.target.value));
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.ageGroup || 'Youth'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Import Mode:
                    </label>
                    <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setCsvImportMode('replace')}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          csvImportMode === 'replace'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Replace Team
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvImportMode('append')}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          csvImportMode === 'append'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Append / Merge
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drag & Drop File Upload Area */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setCsvFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const content = evt.target?.result as string;
                        setCsvText(content);
                        const targetTeam = assignedTeamId || activeTeamId || teams[0]?.id;
                        setCsvPreviewPlayers(parseCSVRawText(content, targetTeam));
                      };
                      reader.readAsText(file);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01]'
                      : 'border-slate-700 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2.5">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-xs text-slate-200">
                    {csvFileName ? (
                      <span className="text-emerald-400 font-mono">Selected: {csvFileName}</span>
                    ) : (
                      'Click to browse or drag and drop your CSV file here'
                    )}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports .csv, .txt, and .tsv formats with column headers (Jersey, Name, Pos, Notes...)
                  </p>
                </div>

                {/* Paste Textarea Alternative */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Or Paste CSV Text Directly:
                    </label>
                    {csvText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCsvText('');
                          setCsvPreviewPlayers([]);
                          setCsvFileName(null);
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-300"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={csvText}
                    onChange={(e) => handleCsvTextChange(e.target.value)}
                    placeholder="Jersey, FirstName, LastName, PrimaryPos, SecondaryPos&#10;10, Alex, Smith, QB, FS&#10;2, Jordan, Taylor, RB, CB"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />
                </div>

                {/* Live Parsed Preview Table */}
                {csvPreviewPlayers.length > 0 && (
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready to Import: {csvPreviewPlayers.length} Players Found</span>
                      </span>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-1.5 px-2.5">#</th>
                            <th className="py-1.5 px-2.5">Player Name</th>
                            <th className="py-1.5 px-2.5">Roster Name</th>
                            <th className="py-1.5 px-2.5">Offense</th>
                            <th className="py-1.5 px-2.5">Defense</th>
                            <th className="py-1.5 px-2.5">Captain</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {csvPreviewPlayers.slice(0, 8).map((p, i) => (
                            <tr key={i}>
                              <td className="py-1 px-2.5 font-mono font-bold text-indigo-300">#{p.num}</td>
                              <td className="py-1 px-2.5 font-bold text-slate-200">
                                {p.firstName} {p.lastName}
                              </td>
                              <td className="py-1 px-2.5 font-bold text-indigo-300">
                                {p.rosterName || p.lastName || p.firstName}
                              </td>
                              <td className="py-1 px-2.5 text-indigo-300 font-bold">{p.primaryPosition || 'ATH'}</td>
                              <td className="py-1 px-2.5 text-amber-300 font-bold">{p.secondaryPosition || 'ATH'}</td>
                              <td className="py-1 px-2.5">{p.isCaptain ? '★ Yes' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreviewPlayers.length > 8 && (
                        <div className="py-1.5 text-center text-slate-500 text-[10px]">
                          + {csvPreviewPlayers.length - 8} more players
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Import Action Button */}
                <button
                  type="button"
                  onClick={handleExecuteImportCSV}
                  disabled={csvPreviewPlayers.length === 0 && !csvText.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    Import {csvPreviewPlayers.length > 0 ? `${csvPreviewPlayers.length} Players` : 'Roster'} into{' '}
                    {teams.find((t) => t.id === assignedTeamId)?.name || 'Team'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: COPY PLAYERS BETWEEN TEAMS */}
          {activeTab === 'copy' && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="bg-slate-850 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h4 className="font-black text-sm text-slate-100">Clone Roster Across Teams</h4>
                    <p className="text-xs text-slate-400">
                      Quickly copy player profiles from one team to another.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Source Team (Copy From):
                    </label>
                    <select
                      value={copySourceTeamId}
                      onChange={(e) => setCopySourceTeamId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {teams.map((t) => {
                        const count = roster.filter((p) => (p.teamId || teams[0]?.id) === t.id).length;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} ({count} players)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Target Team (Paste Into):
                    </label>
                    <select
                      value={copyTargetTeamId}
                      onChange={(e) => setCopyTargetTeamId(e.target.value)}
                      className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl px-3 py-2 text-xs font-bold text-indigo-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {teams.map((t) => {
                        const count = roster.filter((p) => (p.teamId || teams[0]?.id) === t.id).length;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} (currently {count} players)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    How this works:
                  </p>
                  <p className="text-[11px] text-slate-400 pl-3">
                    All players from the source team will be cloned into the target team with the same jersey numbers,
                    names, and position assignments. Existing players on other teams remain untouched.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteCopyRoster}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Players to Target Team</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
