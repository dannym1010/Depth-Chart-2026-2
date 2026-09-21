import React, { useState } from 'react';
import { History, RotateCcw, X, Download, Upload, CheckCircle, AlertTriangle, PlaySquare, Calendar } from 'lucide-react';
import { CallSheetFullData } from '../types/callSheet';
import { CallSheetSnapshot, getCallSheetSnapshots, countCallSheetPlays, countCallSheetSections } from '../utils/callSheetStorage';

interface CallSheetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCallSheet: CallSheetFullData;
  onRestoreCallSheet: (restored: CallSheetFullData) => void;
}

export const CallSheetHistoryModal: React.FC<CallSheetHistoryModalProps> = ({
  isOpen,
  onClose,
  currentCallSheet,
  onRestoreCallSheet,
}) => {
  const [snapshots, setSnapshots] = useState<CallSheetSnapshot[]>(() => getCallSheetSnapshots());
  const [selectedSnapshot, setSelectedSnapshot] = useState<CallSheetSnapshot | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlayCount = countCallSheetPlays(currentCallSheet);
  const currentSecCount = countCallSheetSections(currentCallSheet);

  const handleRefreshList = () => {
    setSnapshots(getCallSheetSnapshots());
  };

  const handleRestore = (snap: CallSheetSnapshot) => {
    const confirm = window.confirm(
      `Restore call sheet from ${snap.dateFormatted} (${snap.playCount} plays, ${snap.sectionCount} sections)? This will replace your current active call sheet.`
    );
    if (!confirm) return;

    onRestoreCallSheet(snap.data);
    setRestoreSuccess(`Restored version from ${snap.dateFormatted}!`);
    setTimeout(() => {
      setRestoreSuccess(null);
      onClose();
    }, 1200);
  };

  const handleExportJson = (data: CallSheetFullData, name: string) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call_sheet_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && (parsed.offenseSections || parsed.defenseSections)) {
          onRestoreCallSheet(parsed);
          setRestoreSuccess(`Successfully imported call sheet from file!`);
          setTimeout(() => {
            setRestoreSuccess(null);
            onClose();
          }, 1200);
        } else {
          alert('Invalid call sheet file. Could not find offense or defense sections.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-750 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Call Sheet Revisions & Backups
              </h2>
              <p className="text-xs text-slate-400">
                Current Active: <span className="text-indigo-300 font-semibold">{currentPlayCount} plays</span> across{' '}
                <span className="text-indigo-300 font-semibold">{currentSecCount} sections</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportJson(currentCallSheet, 'current_backup')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Download backup file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {restoreSuccess && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2.5 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        {/* Snapshots List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {snapshots.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400">
              <AlertTriangle className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
              <p className="font-semibold text-sm text-slate-300">No previous backups recorded yet</p>
              <p className="text-xs mt-1 text-slate-500">
                Snapshots are automatically captured each time you modify plays, titles, or sections.
              </p>
            </div>
          ) : (
            snapshots.map((snap, idx) => {
              const isSelected = selectedSnapshot?.id === snap.id;
              const dateObj = new Date(snap.timestamp);
              const isRecent = Date.now() - snap.timestamp < 3600000;

              return (
                <div
                  key={snap.id}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500/60 shadow-xs'
                      : 'bg-slate-850/60 border-slate-750/80 hover:border-slate-650 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        idx === 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {idx === 0 ? 'LATEST' : `#${idx + 1}`}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          {snap.title || 'Call Sheet'}
                        </span>
                        {isRecent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Recent
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <PlaySquare className="w-3.5 h-3.5 text-indigo-400" />
                          {snap.playCount} plays ({snap.sectionCount} sections)
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {snap.dateFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportJson(snap.data, `snapshot_${snap.dateFormatted}`)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
                      title="Export this snapshot to JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(snap)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Restore this version onto your call sheet"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-750 bg-slate-850 flex items-center justify-between text-xs text-slate-400">
          <span>Automatic snapshots safeguard all play placements, sections, and notes.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold cursor-pointer border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
