import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  Upload,
  FileJson,
  CheckSquare,
  Square,
  CheckCircle2,
  Layers,
  Dumbbell,
  Calendar,
  Users,
  BookOpen,
  Shield,
  Activity,
  FileText,
  Sparkles,
  Database,
  ArrowLeft,
} from 'lucide-react';
import { Team, DrillFolder } from '../../types';
import { summarizeHudlScoutBackup } from '../../utils/remoteStateMerge';

/* =========================================================================
   SELECTIVE IMPORT / RESTORE BACKUP MODAL
   ========================================================================= */
interface ModuleInfo {
  key: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  countLabel: string;
  description: string;
  isAvailable: boolean;
}

function unwrapBackupData(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.state && typeof raw.state === 'object') {
    return unwrapBackupData(raw.state);
  }
  if (raw.payloadToSave && typeof raw.payloadToSave === 'object') {
    return unwrapBackupData(raw.payloadToSave);
  }
  if (raw.backup && typeof raw.backup === 'object') {
    return unwrapBackupData(raw.backup);
  }
  if (raw.data && typeof raw.data === 'object' && !raw.weeklyData && !raw.depthChart && !raw.roster) {
    return unwrapBackupData(raw.data);
  }
  return raw;
}

function inspectBackupModules(raw: any): ModuleInfo[] {
  if (!raw || typeof raw !== 'object') return [];
  const parsed = unwrapBackupData(raw);

  // Weekly data and depth chart detection
  const hasDirectDepthChart = Boolean(
    parsed.depthChart && typeof parsed.depthChart === 'object' && Object.keys(parsed.depthChart).length > 0
  );

  const rawEntries = Object.entries(parsed || {});
  const isRawDepthChartMap =
    !hasDirectDepthChart &&
    !parsed.weeklyData &&
    rawEntries.length > 0 &&
    rawEntries.every(
      ([k, v]) =>
        Array.isArray(v) &&
        !['cascadingDrills', 'practiceData', 'scheduleEvents', 'roster', 'savedCoaches', 'staffList', 'playDatabase'].includes(k)
    );

  const weekEntries = rawEntries.filter(
    ([k, v]: [string, any]) =>
      v && typeof v === 'object' && !Array.isArray(v) && (v.depthChart || v.formations || v.scrimmageChart)
  );
  const hasWeekDepthCharts = weekEntries.length > 0;

  const hasWeekly = Boolean(
    parsed.weeklyData ||
      hasDirectDepthChart ||
      isRawDepthChartMap ||
      hasWeekDepthCharts ||
      (parsed['0'] && parsed['0'].depthChart) ||
      (parsed.wk1 && parsed.wk1.depthChart)
  );

  let weekCount = 0;
  let directDCSlots = 0;
  if (parsed.weeklyData && typeof parsed.weeklyData === 'object') {
    const wSource = parsed.weeklyData;
    weekCount =
      Object.keys(wSource).filter(
        (k) =>
          k.toLowerCase().includes('week') ||
          k.toLowerCase().includes('wk') ||
          !isNaN(Number(k))
      ).length || Object.keys(wSource).length;
  } else if (hasWeekDepthCharts) {
    weekCount = weekEntries.length;
  } else if (hasDirectDepthChart) {
    directDCSlots = Object.keys(parsed.depthChart).length;
  } else if (isRawDepthChartMap) {
    directDCSlots = rawEntries.length;
  }

  // Practice plans
  const hasPractice = Array.isArray(parsed.practiceData) && parsed.practiceData.length > 0;
  const practiceCount = hasPractice ? parsed.practiceData.length : 0;

  // Practice templates
  const hasTemplates = Boolean(
    parsed.practiceTemplates &&
      typeof parsed.practiceTemplates === 'object' &&
      Object.keys(parsed.practiceTemplates).length > 0
  );
  const templateCount = hasTemplates ? Object.keys(parsed.practiceTemplates).length : 0;

  // Cascading drills
  const hasDrills = Array.isArray(parsed.cascadingDrills) && parsed.cascadingDrills.length > 0;
  let totalDrills = 0;
  let folderCount = 0;
  if (hasDrills) {
    const countDrills = (folders: DrillFolder[]) => {
      folders.forEach((f) => {
        folderCount++;
        totalDrills += f.drills?.length || 0;
        if (f.subfolders) countDrills(f.subfolders);
      });
    };
    countDrills(parsed.cascadingDrills);
  }

  // Default Formations & Offensive/Defensive Alignments
  let defaultCount = 0;
  if (Array.isArray(parsed.defaultFormations) && parsed.defaultFormations.length > 0) {
    defaultCount = parsed.defaultFormations.length;
  } else if (Array.isArray(parsed.formations) && parsed.formations.length > 0) {
    defaultCount = parsed.formations.length;
  } else if (Array.isArray(parsed.offensiveFormations) || Array.isArray(parsed.offenseFormations)) {
    defaultCount =
      (parsed.offensiveFormations?.length || 0) +
      (parsed.offenseFormations?.length || 0) +
      (parsed.defensiveFormations?.length || 0) +
      (parsed.defenseFormations?.length || 0);
  } else if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0]?.positions || parsed[0]?.rows || parsed[0]?.unit)) {
    defaultCount = parsed.length;
  } else if (parsed.weeklyData && typeof parsed.weeklyData === 'object') {
    const fIds = new Set<string>();
    Object.values(parsed.weeklyData).forEach((wk: any) => {
      if (wk && Array.isArray(wk.formations)) {
        wk.formations.forEach((f: any) => {
          if (f?.id) fIds.add(f.id);
        });
      }
    });
    defaultCount = fIds.size;
  }
  const hasDefaults = defaultCount > 0;

  // Guides
  const hasGuides = Boolean(
    parsed.guideTree ||
      parsed.pdfGuidesTree ||
      parsed.guideOrder ||
      parsed.pdfGuidesOrder
  );

  // Staff & Coaches
  const hasStaff = Boolean(
    (Array.isArray(parsed.savedCoaches) && parsed.savedCoaches.length > 0) ||
      (Array.isArray(parsed.staffList) && parsed.staffList.length > 0) ||
      (Array.isArray(parsed.savedCoachesList) && parsed.savedCoachesList.length > 0)
  );
  const staffCount =
    (parsed.savedCoaches?.length || 0) +
    (parsed.staffList?.length || 0) +
    (parsed.savedCoachesList?.length || 0);

  // Master Plays
  const hasPlays = Boolean(
    parsed.masterPlayLibrary &&
      typeof parsed.masterPlayLibrary === 'object' &&
      Object.keys(parsed.masterPlayLibrary).length > 0
  );
  const playCount = hasPlays ? Object.keys(parsed.masterPlayLibrary).length : 0;

  // Schedule Events
  const hasSchedule = Array.isArray(parsed.scheduleEvents) && parsed.scheduleEvents.length > 0;
  const scheduleCount = hasSchedule ? parsed.scheduleEvents.length : 0;

  // Roster
  const hasRoster = Boolean(
    (Array.isArray(parsed.roster) && parsed.roster.length > 0) ||
    (Array.isArray(parsed.players) && parsed.players.length > 0)
  );
  const rosterCount = (parsed.roster || parsed.players || []).length;

  // Call Sheet Data
  const csObj = parsed.callSheetData || parsed.callSheet;
  const hasCallSheet = Boolean(
    csObj &&
    (Array.isArray(csObj.offenseSections) || Array.isArray(csObj.defenseSections)) &&
    ((csObj.offenseSections?.length || 0) + (csObj.defenseSections?.length || 0) > 0)
  );
  let callSheetSecCount = 0;
  let callSheetPlayCount = 0;
  if (hasCallSheet && csObj) {
    const allSecs = [...(csObj.offenseSections || []), ...(csObj.defenseSections || [])];
    callSheetSecCount = allSecs.length;
    allSecs.forEach((sec: any) => {
      callSheetPlayCount += (sec.plays || []).filter(Boolean).length;
    });
  }

  // Wristband Data
  const wbObj = parsed.wristbandData || parsed.wristband;
  const hasWristband = Boolean(
    wbObj &&
    Array.isArray(wbObj.wristbands) &&
    wbObj.wristbands.length > 0
  );
  const wristbandCount = hasWristband ? wbObj.wristbands.length : 0;
  let totalWbPlays = 0;
  if (hasWristband) {
    wbObj.wristbands.forEach((wb: any) => {
      (wb.columns || []).forEach((col: any) => {
        totalWbPlays += (col.plays || []).filter((p: any) => p && p.text && p.text.trim()).length;
      });
    });
  }

  // Game Day Play Database
  const hasPlayDb = Array.isArray(parsed.playDatabase) && parsed.playDatabase.length > 0;
  const playDbCount = hasPlayDb ? parsed.playDatabase.length : 0;
  const hudlSummary = summarizeHudlScoutBackup(parsed);

  return [
    {
      key: 'cascadingDrills',
      name: '💥 Master Drill Library',
      category: 'Training & Drills',
      icon: <Dumbbell className="w-5 h-5 text-emerald-400" />,
      countLabel: hasDrills ? `${totalDrills} drills • ${folderCount} categories` : 'Not found in file',
      description: 'All categorized exercises, agility circuits, tackling & blocking progressions',
      isAvailable: hasDrills,
    },
    {
      key: 'practiceData',
      name: '📋 Practice Plans & Schedules',
      category: 'Practice & Schedule',
      icon: <Calendar className="w-5 h-5 text-amber-400" />,
      countLabel: hasPractice ? `${practiceCount} practice plans` : 'Not found in file',
      description: 'Full timeline practices, station coaches, drill allocations, & notes',
      isAvailable: hasPractice,
    },
    {
      key: 'practiceTemplates',
      name: '⚡ Practice Period Templates',
      category: 'Practice & Schedule',
      icon: <Activity className="w-5 h-5 text-purple-400" />,
      countLabel: hasTemplates ? `${templateCount} period templates` : 'Not found in file',
      description: 'Saved custom period formats (e.g. 5-Station Tackle Circuit, Indy, Specials)',
      isAvailable: hasTemplates,
    },
    {
      key: 'weeklyData',
      name: '🏈 Weekly Game Plans & Depth Charts',
      category: 'Playbook Core',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      countLabel: hasWeekly
        ? directDCSlots > 0
          ? `${directDCSlots} depth chart positions (Current Game Plan)`
          : `${weekCount} game weeks • Depth Charts`
        : 'Not found in file',
      description: 'Weekly offensive/defensive formation charts, player spot assignments, & notes',
      isAvailable: hasWeekly,
    },
    {
      key: 'defaultFormations',
      name: '📐 Default Formations & Alignments',
      category: 'Playbook Core',
      icon: <Shield className="w-5 h-5 text-sky-400" />,
      countLabel: hasDefaults ? `${defaultCount} base formations` : 'Not found in file',
      description: 'Base offensive and defensive field coordinates, positions, and alignments',
      isAvailable: hasDefaults,
    },
    {
      key: 'guideTree',
      name: '📖 Playbook PDF Guides & Structure',
      category: 'Playbook Core',
      icon: <BookOpen className="w-5 h-5 text-pink-400" />,
      countLabel: hasGuides ? 'Guides tree & order' : 'Not found in file',
      description: 'Playbook PDF documents, folder hierarchy, and custom manual ordering',
      isAvailable: hasGuides,
    },
    {
      key: 'staffList',
      name: '🧢 Coaching Staff & Directory',
      category: 'Administration',
      icon: <Users className="w-5 h-5 text-teal-400" />,
      countLabel: hasStaff ? `${staffCount} coaches/staff` : 'Not found in file',
      description: 'Saved coach names, station assignments, and team staff directory',
      isAvailable: hasStaff,
    },
    {
      key: 'masterPlayLibrary',
      name: '🎯 Master Play Library',
      category: 'Playbook Core',
      icon: <FileText className="w-5 h-5 text-cyan-400" />,
      countLabel: hasPlays ? `${playCount} play collections` : 'Not found in file',
      description: 'Offensive run/pass plays, defensive coverages, and play call sheets',
      isAvailable: hasPlays,
    },
    {
      key: 'scheduleEvents',
      name: '📅 Season Schedule & Calendar',
      category: 'Administration',
      icon: <Calendar className="w-5 h-5 text-rose-400" />,
      countLabel: hasSchedule ? `${scheduleCount} calendar events` : 'Not found in file',
      description: 'Games, practices, scrimmages, and location details',
      isAvailable: hasSchedule,
    },
    {
      key: 'callSheetData',
      name: '📑 Sideline Call Sheet',
      category: 'Game Day & Sideline',
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      countLabel: hasCallSheet ? `${callSheetSecCount} sections • ${callSheetPlayCount} plays` : 'Not found in file',
      description: 'Offensive & Defensive game day call sheet tables, scripts, & situational sections',
      isAvailable: hasCallSheet,
    },
    {
      key: 'wristbandData',
      name: '🔤 Player Wristband Cards',
      category: 'Game Day & Sideline',
      icon: <Square className="w-5 h-5 text-cyan-400" />,
      countLabel: hasWristband ? `${wristbandCount} wristband cards • ${totalWbPlays} plays` : 'Not found in file',
      description: 'Continuous-numbered wristband inserts, column colors, and player play assignments',
      isAvailable: hasWristband,
    },
    {
      key: 'playDatabase',
      name: '📚 Game Day Play Database',
      category: 'Playbook Core',
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      countLabel: hasPlayDb ? `${playDbCount} game day plays` : 'Not found in file',
      description: 'Master catalog of tagged plays with personnel groupings, motions, and run/pass tags',
      isAvailable: hasPlayDb,
    },
    {
      key: 'hudlScout',
      name: 'Hudl Scout uploads',
      category: 'Scouting',
      icon: <FileText className="w-5 h-5 text-orange-400" />,
      countLabel: hudlSummary.isAvailable
        ? `${hudlSummary.playCount} plays • ${hudlSummary.weekCount} opponent weeks • ${hudlSummary.teamCount} our-team files`
        : 'Not found in file',
      description: 'Uploaded Hudl CSV/Excel scout reports for opponents and our team',
      isAvailable: hudlSummary.isAvailable,
    },
    {
      key: 'roster',
      name: '👥 Team Roster',
      category: 'Administration',
      icon: <Users className="w-5 h-5 text-blue-400" />,
      countLabel: hasRoster ? `${rosterCount} players` : 'Not found in file',
      description: 'Player roster names, jersey numbers, and primary position slots',
      isAvailable: hasRoster,
    },
  ];
}

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySelectiveImport: (
    parsedData: any,
    selectedOptions: Record<string, boolean>
  ) => void;
}

export const ImportBackupModal: React.FC<ImportBackupModalProps> = ({
  isOpen,
  onClose,
  onApplySelectiveImport,
}) => {
  const [step, setStep] = useState<'upload' | 'select'>('upload');
  const [parsedData, setParsedData] = useState<any>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessParsedData = (data: any, name = 'Backup File', sizeStr = '') => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Parsed backup file is empty or not a valid object.');
      }
      const modules = inspectBackupModules(data);
      const availableModules = modules.filter((m) => m.isAvailable);

      if (availableModules.length === 0) {
        throw new Error('No compatible playbook modules found in this JSON backup.');
      }

      // Default all available modules to checked
      const initialSelection: Record<string, boolean> = {};
      modules.forEach((m) => {
        initialSelection[m.key] = m.isAvailable;
      });

      setParsedData(data);
      setFileName(name);
      setFileSize(sizeStr);
      setSelectedModules(initialSelection);
      setError(null);
      setStep('select');
    } catch (err: any) {
      setError(err.message || 'Failed to process backup file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let text = evt.target?.result as string;
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }
        text = text.trim();
        const parsed = JSON.parse(text);
        handleProcessParsedData(parsed, file.name, sizeStr);
      } catch (err: any) {
        setError(`Invalid JSON file: ${err.message}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let text = evt.target?.result as string;
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }
        text = text.trim();
        const parsed = JSON.parse(text);
        handleProcessParsedData(parsed, file.name, sizeStr);
      } catch (err: any) {
        setError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPaste = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError('Please paste JSON data first.');
      return;
    }
    try {
      let text = pastedText.trim();
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      const parsed = JSON.parse(text);
      handleProcessParsedData(parsed, 'Pasted Backup Code', `${(pastedText.length / 1024).toFixed(1)} KB`);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleToggleModule = (key: string) => {
    setSelectedModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = (modules: ModuleInfo[]) => {
    const next: Record<string, boolean> = {};
    modules.forEach((m) => {
      if (m.isAvailable) next[m.key] = true;
    });
    setSelectedModules(next);
  };

  const handleDeselectAll = () => {
    setSelectedModules({});
  };

  const handleConfirmRestore = () => {
    if (!parsedData) return;
    const selectedKeys = Object.keys(selectedModules).filter((k) => selectedModules[k]);
    if (selectedKeys.length === 0) {
      setError('Please select at least one module to restore.');
      return;
    }
    onApplySelectiveImport(unwrapBackupData(parsedData), selectedModules);
    onClose();
  };

  const modules = parsedData ? inspectBackupModules(parsedData) : [];
  const availableCount = modules.filter((m) => m.isAvailable).length;
  const selectedCount = Object.keys(selectedModules).filter((k) => selectedModules[k]).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json,.txt,application/json,text/plain,*"
        onChange={handleFileChange}
      />

      <div className="bg-slate-800/98 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-5 md:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-black">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg text-slate-100 flex items-center gap-2">
                Selective Playbook Restore
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                {step === 'upload'
                  ? 'Choose a backup file or paste JSON to choose what to restore'
                  : 'Select specific modules you want to import into your workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Upload / Paste File */}
        {step === 'upload' && (
          <div className="space-y-4 text-xs text-slate-300 overflow-y-auto pr-1">
            {/* Drag & Drop File Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 md:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 hover:border-indigo-500/70 bg-slate-900/60 hover:bg-slate-900/90'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-100">
                Click to browse or drag &amp; drop your backup .JSON file
              </p>
              <p className="text-xs text-slate-300 font-medium mt-1">
                You will be able to review and select individual modules before restoring.
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md">
                  <FileJson className="w-4 h-4" />
                  <span>Choose .JSON Backup File</span>
                </span>
              </div>
            </div>

            {/* Paste Option */}
            <div className="border-t border-slate-700/80 pt-3">
              <label className="font-bold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Or Paste Backup JSON Directly</span>
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setError(null);
                }}
                placeholder='Paste raw backup JSON code here (e.g. {"cascadingDrills": [...], "practiceData": [...]})...'
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner"
              />

              {error && (
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mt-2 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end mt-2.5">
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  disabled={!pastedText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inspect &amp; Select Modules</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Selective Module Inspector */}
        {step === 'select' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Backup Info & Quick Select Toolbar */}
            <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-slate-200 truncate max-w-[200px] md:max-w-xs">
                  {fileName}
                </span>
                {fileSize && (
                  <span className="text-[11px] text-slate-300 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                    {fileSize}
                  </span>
                )}
                <span className="text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30">
                  {availableCount} items found
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(modules)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 transition-all"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 transition-all"
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>Deselect All</span>
                </button>
              </div>
            </div>

            {/* Modules Checkbox List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {modules.map((m) => {
                const isChecked = Boolean(selectedModules[m.key]);
                return (
                  <div
                    key={m.key}
                    onClick={() => m.isAvailable && handleToggleModule(m.key)}
                    className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      !m.isAvailable
                        ? 'opacity-40 border-slate-800 bg-slate-900/30 cursor-not-allowed'
                        : isChecked
                        ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md cursor-pointer hover:bg-indigo-950/60'
                        : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!m.isAvailable}
                        onChange={() => {}} // Handled by container click
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs md:text-sm text-slate-100 truncate">
                            {m.name}
                          </span>
                          {m.isAvailable ? (
                            <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {m.countLabel}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                              Not in backup
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium mt-0.5 line-clamp-1">
                          {m.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Non-destructive notice */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3 text-[11px] text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Safe Selective Restore:</strong> Only the checked modules above will be updated. All your other current playbook data will remain completely untouched.
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setParsedData(null);
                  setError(null);
                }}
                className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 rounded-xl hover:bg-slate-700/50 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={selectedCount === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Restore Selected ({selectedCount} Module{selectedCount === 1 ? '' : 's'})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
