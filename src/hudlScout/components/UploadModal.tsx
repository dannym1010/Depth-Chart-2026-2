import React, { useState, useRef } from 'react';
import { ColumnMapping, autoDetectColumnMapping, isSpreadsheetFilename, parseCsvRows, workbookBufferToCsv } from '../utils/csvParser';
import { SAMPLE_DATASETS, SampleDataset } from '../data/sampleDatasets';
import { Upload, X, FileText, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCsv: (csvContent: string, opponentName: string, customMapping?: ColumnMapping, append?: boolean) => void;
  onSelectSample: (sample: SampleDataset) => void;
  hasExistingPlays?: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onLoadCsv,
  onSelectSample,
  hasExistingPlays = false,
}) => {
  const [csvText, setCsvText] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowsCount, setRowsCount] = useState(0);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [appendGame, setAppendGame] = useState(true);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const loadFile = (file: File) => {
    setFileError('');
    const suggestedName = file.name.replace(/\.[^/.]+$/, '');
    if (isSpreadsheetFilename(file.name)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const csv = workbookBufferToCsv(buffer);
          if (!csv.trim()) {
            setFileError('That spreadsheet has no play rows. Try another sheet or export CSV from Hudl.');
            return;
          }
          processCsvContent(csv, suggestedName);
        } catch {
          setFileError('Could not read that Excel file. Save as .xlsx or .csv and try again.');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      processCsvContent(content, suggestedName);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    loadFile(file);
  };

  const processCsvContent = (content: string, suggestedName: string) => {
    setCsvText(content);
    setOpponentName(suggestedName || 'Opponent Team');
    const { headers: h, rows } = parseCsvRows(content);
    setHeaders(h);
    setRowsCount(rows.length);
    setPreviewRows(rows.slice(0, 3));

    const detected = autoDetectColumnMapping(h);
    setMapping(detected);
  };

  const handleImport = () => {
    if (!csvText || rowsCount === 0) return;
    onLoadCsv(csvText, opponentName || 'Opponent', mapping || undefined, Boolean(hasExistingPlays && appendGame));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Upload Hudl CSV or Excel</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Active Uploaded Carmel Dataset Quick Reload */}
          {SAMPLE_DATASETS.length > 0 && (
            <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300">Carmel High School (Last 2 Games)</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded">
                    Uploaded Dataset
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  156 Hudl snaps (52 Carmel Offense, 56 Carmel Defense, Special Teams).
                </p>
              </div>
              <button
                onClick={() => {
                  onSelectSample(SAMPLE_DATASETS[0]);
                  onClose();
                }}
                className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 transition-colors"
              >
                Reload Carmel Film
              </button>
            </div>
          )}

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Upload New Hudl CSV or XLSX:
            </span>

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 bg-slate-950/60 hover:bg-slate-950 rounded-lg p-6 text-center cursor-pointer transition-all"
            >
              <FileText className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-200 font-bold mb-1">
                Drop a Hudl CSV or Excel file here, or browse
              </p>
              <p className="text-[11px] text-slate-400">
                .csv, .xlsx, .xls — Down, Distance, Yard Line, Hash, Play Dir, Formation, Gain/Loss
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {fileError && (
            <div className="flex items-start gap-2 text-rose-300 bg-rose-950/40 border border-rose-800 rounded px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          {/* File Parsed Preview */}
          {rowsCount > 0 && mapping && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>File read: {rowsCount} plays loaded</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  {showAdvancedMapping ? 'Hide Column Mapping' : 'Customize Column Mapping'}
                </button>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">
                  Game / team name:
                </label>
                <input
                  type="text"
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {hasExistingPlays && (
                <label className="flex items-center gap-2 text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={appendGame}
                    onChange={(e) => setAppendGame(e.target.checked)}
                  />
                  Add this game to the current report (keep existing snaps)
                </label>
              )}

              {/* Column Mapping Table */}
              {showAdvancedMapping && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Column Mapping Verification:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((key) => (
                      <div key={key} className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <select
                          value={mapping[key]}
                          onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                          className="bg-slate-950 text-slate-200 text-xs px-2 py-0.5 rounded border border-slate-800 focus:outline-none max-w-[130px] truncate"
                        >
                          <option value="">(None)</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Film Record Preview (First 3 plays):
                </span>
                <div className="overflow-x-auto border border-slate-800 rounded">
                  <table className="w-full text-left text-[11px] text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-1.5">Down</th>
                        <th className="p-1.5">Dist</th>
                        <th className="p-1.5">Formation</th>
                        <th className="p-1.5">Play</th>
                        <th className="p-1.5">Gain</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          <td className="p-1.5">{r[mapping.down] || '-'}</td>
                          <td className="p-1.5">{r[mapping.distance] || '-'}</td>
                          <td className="p-1.5">{r[mapping.formation] || '-'}</td>
                          <td className="p-1.5">{r[mapping.playName] || '-'}</td>
                          <td className="p-1.5 font-bold font-mono">{r[mapping.gainLoss] || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={rowsCount === 0}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-md shadow disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <span>{hasExistingPlays && appendGame ? 'Add game to report' : 'Analyze Dataset'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
