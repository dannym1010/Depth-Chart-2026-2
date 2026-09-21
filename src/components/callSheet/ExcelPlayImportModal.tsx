import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Clipboard,
  Download,
  X,
  Check,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { PlayDatabaseEntry, PlayType } from '../../types/callSheet';
import { inferFormation, extractPersonnel } from '../../utils/wristbandLinking';

interface ExcelPlayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUnit?: 'offense' | 'defense';
  existingPlaysCount: number;
  onImportPlays: (
    newPlays: PlayDatabaseEntry[],
    mode: 'append' | 'replace'
  ) => void;
}

type ImportSourceTab = 'file' | 'paste';

interface ColumnMapping {
  nameCol: number;
  formationCol: number;
  typeCol: number;
  unitCol: number;
  wristbandCol: number;
  personnelCol: number;
  conceptCol: number;
  situationsCol: number;
}

export const ExcelPlayImportModal: React.FC<ExcelPlayImportModalProps> = ({
  isOpen,
  onClose,
  defaultUnit = 'offense',
  existingPlaysCount,
  onImportPlays,
}) => {
  const [activeTab, setActiveTab] = useState<ImportSourceTab>('file');
  const [fileData, setFileData] = useState<{
    fileName: string;
    sheetNames: string[];
    selectedSheet: string;
    rawWorkbook: XLSX.WorkBook | null;
  } | null>(null);

  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [pastedText, setPastedText] = useState('');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [unitOverride, setUnitOverride] = useState<'auto' | 'offense' | 'defense'>('auto');
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping indices (-1 means unmapped)
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameCol: 0,
    formationCol: -1,
    typeCol: -1,
    unitCol: -1,
    wristbandCol: -1,
    personnelCol: -1,
    conceptCol: -1,
    situationsCol: -1,
  });

  // Auto-detect columns from header row
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const newMap: ColumnMapping = {
      nameCol: -1,
      formationCol: -1,
      typeCol: -1,
      unitCol: -1,
      wristbandCol: -1,
      personnelCol: -1,
      conceptCol: -1,
      situationsCol: -1,
    };

    headers.forEach((hdr, idx) => {
      const h = hdr.toLowerCase().trim();
      if (
        (h.includes('name') || h.includes('play') || h === 'call') &&
        newMap.nameCol === -1 &&
        !h.includes('formation') &&
        !h.includes('type')
      ) {
        newMap.nameCol = idx;
      } else if (h.includes('formation') || h === 'form' || h === 'set') {
        newMap.formationCol = idx;
      } else if (h.includes('type') || h === 'play type' || h === 'category') {
        newMap.typeCol = idx;
      } else if (h.includes('unit') || h === 'o/d' || h === 'side') {
        newMap.unitCol = idx;
      } else if (
        h.includes('wrist') ||
        h.includes('band') ||
        h === '#' ||
        h === 'num' ||
        h === 'number' ||
        h === 'slot'
      ) {
        newMap.wristbandCol = idx;
      } else if (h.includes('personnel') || h.includes('pkg') || h === 'package') {
        newMap.personnelCol = idx;
      } else if (
        h.includes('concept') ||
        h.includes('notes') ||
        h.includes('desc') ||
        h.includes('details')
      ) {
        newMap.conceptCol = idx;
      } else if (
        h.includes('situation') ||
        h.includes('down') ||
        h.includes('tag') ||
        h.includes('hash')
      ) {
        newMap.situationsCol = idx;
      }
    });

    // Fallback: if nameCol is still -1, default to 0
    if (newMap.nameCol === -1) {
      newMap.nameCol = 0;
    }

    return newMap;
  };

  // Process raw workbook sheet into array of string arrays
  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    try {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) return;

      const data: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const stringRows: string[][] = data.map((row) =>
        row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ''))
      );

      // Filter out completely empty rows
      const nonEmpty = stringRows.filter((row) => row.some((c) => c !== ''));
      setRawRows(nonEmpty);

      if (nonEmpty.length > 0) {
        const detected = autoDetectColumns(nonEmpty[0]);
        setMapping(detected);
      }
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage('Failed to read worksheet: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readUploadedFile(file);
  };

  const readUploadedFile = (file: File) => {
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          setErrorMessage('The uploaded spreadsheet contains no readable sheets.');
          return;
        }

        const firstSheet = wb.SheetNames[0];
        setFileData({
          fileName: file.name,
          sheetNames: wb.SheetNames,
          selectedSheet: firstSheet,
          rawWorkbook: wb,
        });

        processSheet(wb, firstSheet);
      } catch (err: any) {
        setErrorMessage('Could not parse Excel/CSV file: ' + (err.message || 'Format error'));
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error reading file.');
    };
    reader.readAsBinaryString(file);
  };

  // Handle Sheet Change
  const handleSheetSelect = (newSheet: string) => {
    if (!fileData || !fileData.rawWorkbook) return;
    setFileData({
      ...fileData,
      selectedSheet: newSheet,
    });
    processSheet(fileData.rawWorkbook, newSheet);
  };

  // Handle Textarea Paste
  const handleParsePastedText = () => {
    setErrorMessage(null);
    if (!pastedText.trim()) {
      setErrorMessage('Please paste tabular text from Excel or Google Sheets first.');
      return;
    }

    try {
      // Split lines and tabs
      const lines = pastedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const rows: string[][] = lines.map((line) => {
        if (line.includes('\t')) {
          return line.split('\t').map((c) => c.trim());
        } else if (line.includes(',')) {
          // simple comma split
          return line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        }
        return [line.trim()];
      });

      setRawRows(rows);
      if (rows.length > 0) {
        const detected = autoDetectColumns(rows[0]);
        setMapping(detected);
      }
      setFileData(null);
    } catch (err: any) {
      setErrorMessage('Failed to parse pasted text: ' + (err.message || ''));
    }
  };

  // Infer play type from string
  const inferPlayType = (
    typeStr: string,
    playName: string,
    unit: 'offense' | 'defense'
  ): PlayType => {
    const combined = `${typeStr} ${playName}`.toLowerCase();
    if (unit === 'defense') {
      if (combined.includes('blitz') || combined.includes('fire') || combined.includes('dog') || combined.includes('pressure')) {
        return 'blitz';
      }
      if (combined.includes('goal') || combined.includes('jumbo') || combined.includes('heavy')) {
        return 'goal_line';
      }
      if (combined.includes('run') || combined.includes('front')) {
        return 'run';
      }
      return 'coverage';
    }

    // Offense
    if (combined.includes('screen') || combined.includes('tunnel')) return 'screen';
    if (combined.includes('play action') || combined.includes('pa ') || combined.includes('boot') || combined.includes('waggle')) {
      return 'play_action';
    }
    if (combined.includes('rpo') || combined.includes('read option')) return 'rpo';
    if (combined.includes('trick') || combined.includes('reverse') || combined.includes('flea') || combined.includes('special')) {
      return 'trick';
    }
    if (combined.includes('2 pt') || combined.includes('2pt') || combined.includes('two point')) {
      return 'two_point';
    }
    if (combined.includes('pass') || combined.includes('slant') || combined.includes('verts') || combined.includes('flood') || combined.includes('mesh')) {
      return 'pass';
    }
    return 'run';
  };

  // Infer unit from row
  const inferUnit = (unitStr: string, rowUnitOverride: 'auto' | 'offense' | 'defense'): 'offense' | 'defense' => {
    if (rowUnitOverride !== 'auto') return rowUnitOverride;
    const u = unitStr.toLowerCase().trim();
    if (u.startsWith('d') || u.includes('def')) return 'defense';
    if (u.startsWith('o') || u.includes('off')) return 'offense';
    return defaultUnit;
  };

  // Parse candidate plays based on current raw rows and mapping
  const parsedPlays = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return [];

    const rowsToProcess = hasHeaderRow ? rawRows.slice(1) : rawRows;
    const results: PlayDatabaseEntry[] = [];

    rowsToProcess.forEach((row, rowIdx) => {
      const name = mapping.nameCol >= 0 && row[mapping.nameCol] ? row[mapping.nameCol].trim() : '';
      if (!name) return; // Skip empty rows

      const unitRaw = mapping.unitCol >= 0 && row[mapping.unitCol] ? row[mapping.unitCol].trim() : '';
      const unit = inferUnit(unitRaw, unitOverride);

      const rawFormation =
        mapping.formationCol >= 0 && row[mapping.formationCol]
          ? row[mapping.formationCol].trim()
          : undefined;
      const formation = inferFormation(name, unit, rawFormation);

      const typeRaw = mapping.typeCol >= 0 && row[mapping.typeCol] ? row[mapping.typeCol].trim() : '';
      const playType = inferPlayType(typeRaw, name, unit);

      const wristbandRaw =
        mapping.wristbandCol >= 0 && row[mapping.wristbandCol] ? row[mapping.wristbandCol].trim() : '';
      const parsedNum = wristbandRaw ? parseInt(wristbandRaw.replace(/[^0-9]/g, ''), 10) : undefined;
      const wristbandNum = !isNaN(Number(parsedNum)) && parsedNum !== undefined ? parsedNum : undefined;

      const rawPersonnel =
        mapping.personnelCol >= 0 && row[mapping.personnelCol] ? row[mapping.personnelCol].trim() : undefined;
      const personnel = extractPersonnel({
        name,
        formation,
        unit,
        personnel: rawPersonnel,
      });

      const concept =
        mapping.conceptCol >= 0 && row[mapping.conceptCol] ? row[mapping.conceptCol].trim() : undefined;

      const situationsRaw =
        mapping.situationsCol >= 0 && row[mapping.situationsCol] ? row[mapping.situationsCol].trim() : '';
      const situations = situationsRaw
        ? situationsRaw.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
        : ['1-10', 'Base'];

      results.push({
        id: `import_${Date.now()}_${rowIdx}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        formation,
        type: playType,
        personnel,
        wristbandNum,
        concept,
        situations,
        unit,
        tags: [playType, unit, formation, personnel].filter(Boolean) as string[],
      });
    });

    return results;
  }, [rawRows, hasHeaderRow, mapping, unitOverride, defaultUnit]);

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sampleOffenseData = [
      ['Play Name', 'Formation', 'Play Type', 'Unit', 'Wristband #', 'Personnel', 'Concept / Notes', 'Situations'],
      ['Power 26 Lead', 'I-Form Right', 'Run', 'Offense', '1', '21 Personnel', 'A-gap kick out by FB', '1-10, 2nd & Short'],
      ['HB Toss Sweep 28', 'Twins Left', 'Run', 'Offense', '2', '11 Personnel', 'Seal edge with TE, speed sweep', '1-10, Open Field'],
      ['Mesh Crossers', 'Spread 2x2', 'Pass', 'Offense', '3', '10 Personnel', 'Underneath crossers at 4-6 yds', '3rd Med, 2-Min'],
      ['Bootleg Slide Flood', 'Pistol Strong', 'Play Action', 'Offense', '4', '21 Personnel', 'Fake zone stretch, QB keeper boot', '1-10, Red Zone'],
      ['Bubble Screen Right', 'Trips Right', 'Screen', 'Offense', '5', '10 Personnel', 'WR stalk blocks, quick outside smoke', '2nd & Long'],
      ['ISO Dive 32 Blast', 'Goal Line Jumbo', 'Run', 'Offense', '6', '23 Personnel', 'Lead block directly on Mike LB', '3rd & 1, Goal Line'],
      ['Philly Special Reverse', 'Shotgun Bunch', 'Trick', 'Offense', '7', '11 Personnel', 'Direct snap RB to WR pass to QB', 'Red Zone, 2-Pt Special'],
    ];

    const sampleDefenseData = [
      ['Play Name', 'Formation', 'Play Type', 'Unit', 'Wristband #', 'Personnel', 'Concept / Notes', 'Situations'],
      ['Cover 3 Sky', '4-3 Base', 'Coverage', 'Defense', '11', 'Base 4-3', 'SS rolls down into flat, 3 deep', '1-10, 2nd Med'],
      ['Cover 2 Hard Corner', '3-4 Odd', 'Coverage', 'Defense', '12', 'Base 3-4', 'CBs jam boundary flat, 2 high safeties', '2nd Long, 3rd Long'],
      ['Crossfire A-Gap Blitz', 'Nickel Over', 'Blitz', 'Defense', '13', 'Nickel 4-2-5', 'Mike & Will cross A gaps on snap', '3rd & Long, 2-Min'],
      ['Goal Line 6-2 Bear Pinch', 'Goal Line 6-2', 'Goal Line', 'Defense', '14', 'Heavy 6-2', 'D-line slants inward, stop dive', '3rd & 1, Goal Line'],
      ['Cover 0 All-Out Pressure', 'Dime 3-2-6', 'Blitz', 'Defense', '15', 'Dime', 'Zero safety help, peel blitz', 'Red Zone, 4th Down'],
    ];

    const wsOffense = XLSX.utils.aoa_to_sheet(sampleOffenseData);
    const wsDefense = XLSX.utils.aoa_to_sheet(sampleDefenseData);

    XLSX.utils.book_append_sheet(wb, wsOffense, 'Offense Plays');
    XLSX.utils.book_append_sheet(wb, wsDefense, 'Defense Plays');

    XLSX.writeFile(wb, 'Football_Play_Library_Template.xlsx');
  };

  // Submit Import
  const handleConfirmImport = () => {
    if (parsedPlays.length === 0) return;
    onImportPlays(parsedPlays, importMode);
    onClose();
  };

  if (!isOpen) return null;

  // Header options for column mapping dropdowns
  const detectedHeaders = rawRows.length > 0 ? rawRows[0] : [];

  const offenseCount = parsedPlays.filter((p) => p.unit === 'offense').length;
  const defenseCount = parsedPlays.filter((p) => p.unit === 'defense').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-750 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Import Plays from Excel</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  .xlsx &bull; .xls &bull; .csv
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Quickly add your team's entire playbook into the master Play Bank
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
              title="Download sample formatted spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sample Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* Source Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'file'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Excel / CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'paste'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste from Excel</span>
              </button>
            </div>

            {/* Mobile Sample Template Link */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="sm:hidden flex items-center gap-1.5 text-xs text-emerald-400 font-bold"
            >
              <Download className="w-3 h-3" />
              <span>Download Excel Template</span>
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
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
                  if (file) readUploadedFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : fileData
                    ? 'border-emerald-500/50 bg-slate-950/70 hover:bg-slate-950'
                    : 'border-slate-750 bg-slate-950/40 hover:bg-slate-950/80 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-850 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  {fileData ? (
                    <div>
                      <p className="font-bold text-sm text-emerald-300">
                        {fileData.fileName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Loaded {rawRows.length} rows &bull; Click to select another file
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-sm text-slate-200">
                        Drag and drop your Excel spreadsheet here, or{' '}
                        <span className="text-emerald-400 underline underline-offset-2">
                          browse files
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports Excel Workbooks (.xlsx, .xls) and Comma-Separated Values (.csv)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sheet Selector (if workbook has multiple sheets) */}
              {fileData && fileData.sheetNames.length > 1 && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 font-bold">Select Sheet:</span>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {fileData.sheetNames.map((sheet) => (
                      <button
                        key={sheet}
                        type="button"
                        onClick={() => handleSheetSelect(sheet)}
                        className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                          fileData.selectedSheet === sheet
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-850 text-slate-300 hover:text-white border border-slate-700'
                        }`}
                      >
                        {sheet}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Paste Direct */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Paste Rows Directly from Excel or Google Sheets:</span>
                  <span className="text-[11px] text-slate-400">
                    Tab-delimited or comma-separated
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Example:\nPlay Name\tFormation\tType\tUnit\t#\nPower 26\tI-Form\tRun\tOffense\t1\nMesh Cross\tSpread\tPass\tOffense\t2\nCover 3 Sky\t4-3 Base\tCoverage\tDefense\t11`}
                  className="w-full p-3 bg-slate-950 border border-slate-750 rounded-2xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Select rows in Excel, press Ctrl+C, click in the box above, and press Ctrl+V
                </span>
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse Pasted Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-2xl flex items-center gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Options & Column Mapping (Displayed when data is loaded) */}
          {rawRows.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {/* Controls bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Header Toggle */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-slate-200 block">First row is Header</span>
                    <span className="text-[10px] text-slate-400">
                      Skip top row from plays list
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Target Unit */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
                  <span className="font-bold text-slate-200 block">Target Unit</span>
                  <select
                    value={unitOverride}
                    onChange={(e) =>
                      setUnitOverride(e.target.value as 'auto' | 'offense' | 'defense')
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="auto">Auto-detect from sheet / column</option>
                    <option value="offense">Force Offense (All plays)</option>
                    <option value="defense">Force Defense (All plays)</option>
                  </select>
                </div>

                {/* Destination Mode */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
                  <span className="font-bold text-slate-200 block">Import Mode</span>
                  <select
                    value={importMode}
                    onChange={(e) =>
                      setImportMode(e.target.value as 'append' | 'replace')
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="append">
                      Append to existing ({existingPlaysCount} plays)
                    </option>
                    <option value="replace">
                      Replace current library entirely
                    </option>
                  </select>
                </div>
              </div>

              {/* Column Mapping Selectors */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Map Spreadsheet Columns</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Detected from your spreadsheet headers
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Play Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <span>Play Name *</span>
                    </label>
                    <select
                      value={mapping.nameCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, nameCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-1.5 text-xs text-white"
                    >
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Formation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Formation
                    </label>
                    <select
                      value={mapping.formationCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, formationCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- Not In Sheet (Default) --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Play Type */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Play Type (Run/Pass/Blitz...)
                    </label>
                    <select
                      value={mapping.typeCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, typeCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- Auto-Infer from Name --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unit */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Unit (Offense/Defense)
                    </label>
                    <select
                      value={mapping.unitCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, unitCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- Default ({defaultUnit.toUpperCase()}) --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Wristband # */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Wristband #
                    </label>
                    <select
                      value={mapping.wristbandCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, wristbandCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- None / Skip --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Personnel */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Personnel / Pkg
                    </label>
                    <select
                      value={mapping.personnelCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, personnelCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- None / Skip --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes / Concept */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Concept / Notes
                    </label>
                    <select
                      value={mapping.conceptCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, conceptCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- None / Skip --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Situations */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">
                      Situations / Tags
                    </label>
                    <select
                      value={mapping.situationsCol}
                      onChange={(e) =>
                        setMapping({ ...mapping, situationsCol: parseInt(e.target.value, 10) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                    >
                      <option value={-1}>-- Base Situations --</option>
                      {detectedHeaders.map((hdr, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {hdr || `[Column ${idx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Preview List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Import Preview ({parsedPlays.length} Plays Detected)
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {offenseCount} Offense &bull; {defenseCount} Defense
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Showing top sample plays
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 max-h-56 overflow-y-auto no-scrollbar">
                  {parsedPlays.slice(0, 8).map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {p.wristbandNum ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] font-mono shrink-0">
                            {String(p.wristbandNum).replace(/^#\s*/, '')}
                          </span>
                        ) : (
                          <span className="w-5 text-center font-mono text-[10px] text-slate-500">
                            {idx + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-100 uppercase truncate">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                            <span className="font-mono text-slate-300">
                              {p.formation}
                            </span>
                            {p.concept && <span>&bull; {p.concept}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            p.unit === 'offense'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {p.unit}
                        </span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {p.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}

                  {parsedPlays.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No valid plays parsed from the current mapping. Make sure the Play Name column is mapped.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-850 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={parsedPlays.length === 0}
            onClick={handleConfirmImport}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              parsedPlays.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              Import {parsedPlays.length} Plays into Library
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
