import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Code,
  FileCode,
  UploadCloud,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Printer,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Edit3,
  Flame,
  Shield,
  Layers,
} from 'lucide-react';
import { ScoutingData, ScoutingAttachment } from '../../types';

interface HtmlTendenciesViewProps {
  scouting: ScoutingData;
  opponentName?: string;
  weekName?: string;
  isPowerAdmin?: boolean;
  onUpdateScouting: (field: keyof ScoutingData, val: any) => void;
  onNavigateToScouting?: () => void;
}

/**
 * Isolated Shadow DOM Container for rendering raw uploaded HTML code
 * Guarantees that CSS is encapsulated and NEVER leaks or gets blocked by iframes.
 */
const ShadowHtmlRenderer: React.FC<{
  html: string;
  zoomScale: number;
  canvasBg: 'paper' | 'dark' | 'slate';
  isFullscreen?: boolean;
}> = ({ html, zoomScale, canvasBg, isFullscreen }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let shadow = hostRef.current.shadowRoot;
    if (!shadow) {
      shadow = hostRef.current.attachShadow({ mode: 'open' });
    }
    shadow.innerHTML =
      html ||
      '<div style="padding: 40px; text-align: center; color: #64748b; font-family: sans-serif;"><h3>No HTML content available</h3></div>';
  }, [html]);

  const bgClass =
    canvasBg === 'paper' ? 'bg-slate-100' : canvasBg === 'dark' ? 'bg-slate-950' : 'bg-slate-900';

  return (
    <div
      className={`w-full overflow-auto flex justify-center p-3 sm:p-5 ${bgClass} transition-colors ${
        isFullscreen ? 'h-[calc(100vh-140px)]' : 'min-h-[560px] max-h-[720px]'
      }`}
    >
      <div
        style={{
          width: `${zoomScale}%`,
          maxWidth: zoomScale > 100 ? `${zoomScale}%` : '100%',
          transition: 'width 0.15s ease-out',
        }}
        className="rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 bg-white"
      >
        <div ref={hostRef} className="w-full min-h-[520px]" />
      </div>
    </div>
  );
};

export const HtmlTendenciesView: React.FC<HtmlTendenciesViewProps> = ({
  scouting,
  opponentName = 'Opponent',
  weekName = 'Week 1',
  isPowerAdmin = true,
  onUpdateScouting,
  onNavigateToScouting,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Extract all HTML attachments from scouting data
  const attachments: ScoutingAttachment[] = useMemo(() => {
    return scouting.attachments || [];
  }, [scouting.attachments]);

  const htmlReports = useMemo(() => {
    return attachments.filter((a) => a.type === 'html');
  }, [attachments]);

  // Selected report ID
  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    return htmlReports.length > 0 ? htmlReports[0].id : '';
  });

  // Ensure valid selection if reports change
  useEffect(() => {
    if (htmlReports.length > 0) {
      if (!selectedReportId || !htmlReports.some((r) => r.id === selectedReportId)) {
        setSelectedReportId(htmlReports[0].id);
      }
    } else {
      setSelectedReportId('');
    }
  }, [htmlReports, selectedReportId]);

  // Currently active report
  const activeReport = useMemo(() => {
    return htmlReports.find((r) => r.id === selectedReportId) || htmlReports[0] || null;
  }, [htmlReports, selectedReportId]);

  // View settings
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [canvasBg, setCanvasBg] = useState<'paper' | 'dark' | 'slate'>('paper');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Paste / New HTML Modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalHtml, setModalHtml] = useState('');
  const [modalCaption, setModalCaption] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Upload HTML file handler
  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && file.type !== 'text/html') {
      alert('Please upload a valid .html or .htm file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const newReport: ScoutingAttachment = {
        id: `html_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'html',
        htmlCode: content,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        caption: `Uploaded on ${new Date().toLocaleDateString()}`,
        createdAt: Date.now(),
        notes: [],
      };

      const updated = [newReport, ...attachments];
      onUpdateScouting('attachments', updated);
      setSelectedReportId(newReport.id);
      showNotification(`Uploaded "${newReport.name}" successfully!`);
    };
    reader.readAsText(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Open Paste Modal for creating new HTML report
  const handleOpenPasteModal = () => {
    setIsEditingExisting(false);
    setModalTitle(`${opponentName} Tendencies (${weekName})`);
    setModalCaption('Hudl / Scouting tendencies code export');
    setModalHtml('');
    setIsPasteModalOpen(true);
  };

  // Open Paste Modal for editing existing HTML report
  const handleOpenEditModal = () => {
    if (!activeReport) return;
    setIsEditingExisting(true);
    setModalTitle(activeReport.name);
    setModalCaption(activeReport.caption || '');
    setModalHtml(activeReport.htmlCode || '');
    setIsPasteModalOpen(true);
  };

  // Save Paste / Edit Modal
  const handleSaveModal = () => {
    if (!modalTitle.trim() || !modalHtml.trim()) {
      alert('Please provide both a Title and HTML Code.');
      return;
    }

    if (isEditingExisting && activeReport) {
      const updated = attachments.map((a) => {
        if (a.id === activeReport.id) {
          return {
            ...a,
            name: modalTitle.trim(),
            caption: modalCaption.trim(),
            htmlCode: modalHtml,
            fileSize: `${(new Blob([modalHtml]).size / 1024).toFixed(1)} KB`,
          };
        }
        return a;
      });
      onUpdateScouting('attachments', updated);
      showNotification('HTML tendency report updated!');
    } else {
      const newReport: ScoutingAttachment = {
        id: `html_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: modalTitle.trim(),
        type: 'html',
        htmlCode: modalHtml,
        fileSize: `${(new Blob([modalHtml]).size / 1024).toFixed(1)} KB`,
        caption: modalCaption.trim() || `Saved on ${new Date().toLocaleDateString()}`,
        createdAt: Date.now(),
        notes: [],
      };
      const updated = [newReport, ...attachments];
      onUpdateScouting('attachments', updated);
      setSelectedReportId(newReport.id);
      showNotification(`Saved "${newReport.name}" successfully!`);
    }

    setIsPasteModalOpen(false);
  };

  // Delete report
  const handleDeleteReport = (id: string) => {
    if (!confirm('Are you sure you want to delete this HTML tendency report?')) return;
    const updated = attachments.filter((a) => a.id !== id);
    onUpdateScouting('attachments', updated);
    showNotification('Report deleted.');
  };

  // Download active report
  const handleDownloadReport = () => {
    if (!activeReport || !activeReport.htmlCode) return;
    const blob = new Blob([activeReport.htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReport.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open active report in new tab
  const handleOpenInNewTab = () => {
    if (!activeReport || !activeReport.htmlCode) return;
    const blob = new Blob([activeReport.htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Print active report
  const handlePrint = () => {
    if (!activeReport || !activeReport.htmlCode) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(activeReport.htmlCode);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    }
  };

  // Generate Sample / Quick Tendencies HTML from current Scouting Data
  const handleGenerateFromScouting = () => {
    const opp = opponentName || scouting.opponent || 'Opponent';
    const wk = weekName || scouting.week || 'Game Week';
    const defFront = scouting.defenseFront || scouting.defensiveFronts || '4-4 Base / 5-3 Under';
    const defCov = scouting.defenseCoverage || 'Cover 3 Sky';
    const offForms = scouting.offenseFormations || 'Shotgun Spread / Pistol Heavy';
    const runPass = scouting.runPassRatio || '65% Run / 35% Pass';
    const tendencies = scouting.offenseTendencies || scouting.offensiveTendencies || 'Heavy off-tackle run tendencies on early downs.';
    const keys = scouting.keysToVictory || [
      'Control the line of scrimmage with violent, low pad level',
      'Pursue with aggressive swarm tackling and edge contain',
    ];

    const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${opp} HTML Tendencies - ${wk}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; line-height: 1.6; }
    .header { background: linear-gradient(135deg, #1e3a8a, #0f172a); border: 1px solid #3b82f6; border-radius: 16px; padding: 20px 24px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; text-transform: uppercase; color: #f59e0b; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; background: rgba(59,130,246,0.2); border: 1px solid #3b82f6; color: #93c5fd; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 18px; }
    .card h2 { margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 6px; }
    .stat-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
    .stat-label { color: #94a3b8; font-weight: 600; }
    .stat-val { color: #ffffff; font-weight: 800; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 6px; font-size: 13px; color: #cbd5e1; }
    .bar { height: 12px; background: #334155; border-radius: 6px; overflow: hidden; display: flex; margin-top: 6px; }
    .bar-run { background: #10b981; width: 65%; }
    .bar-pass { background: #3b82f6; width: 35%; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏈 ${opp} Film Tendencies Matrix</h1>
    <div>
      <span class="badge">${wk}</span>
      <span class="badge" style="border-color:#f59e0b; color:#fbbf24;">HUDL TENDENCY CODE</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>⚡ Offensive Formations &amp; Splits</h2>
      <div class="stat-row"><span class="stat-label">Primary Personnel:</span><span class="stat-val">${offForms}</span></div>
      <div class="stat-row"><span class="stat-label">Run / Pass Breakdown:</span><span class="stat-val">${runPass}</span></div>
      <div class="bar"><div class="bar-run"></div><div class="bar-pass"></div></div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 12px;">${tendencies}</p>
    </div>

    <div class="card">
      <h2>🛡️ Defensive Alignment &amp; Blitzes</h2>
      <div class="stat-row"><span class="stat-label">Base Front:</span><span class="stat-val">${defFront}</span></div>
      <div class="stat-row"><span class="stat-label">Coverage Shell:</span><span class="stat-val">${defCov}</span></div>
      <div class="stat-row"><span class="stat-label">Pressure Tells:</span><span class="stat-val">Fast flow to perimeter</span></div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 12px;">Watch for backside cutbacks on sweep and misdirection plays.</p>
    </div>
  </div>

  <div class="card">
    <h2>🎯 Must-Win Game Keys</h2>
    <ul>
      ${keys.map((k) => `<li>${k}</li>`).join('')}
    </ul>
  </div>
</body>
</html>`;

    const generatedReport: ScoutingAttachment = {
      id: `html_${Date.now()}_generated`,
      name: `${opp} Tendencies Template (${wk})`,
      type: 'html',
      htmlCode: sampleHtml,
      fileSize: `${(new Blob([sampleHtml]).size / 1024).toFixed(1)} KB`,
      caption: `Auto-generated tendencies template from scouting data`,
      createdAt: Date.now(),
      notes: [],
    };

    const updated = [generatedReport, ...attachments];
    onUpdateScouting('attachments', updated);
    setSelectedReportId(generatedReport.id);
    showNotification('Generated HTML tendency template successfully!');
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Feedback Toast */}
      {feedback && (
        <div className="bg-emerald-500/90 text-white text-xs font-black px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-white hover:text-emerald-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner Toolbar */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-200 shadow-lg shadow-amber-600/30">
              <FileCode className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-slate-100 tracking-tight">
                  HTML Code Tendencies &amp; Film Reports
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                  {opponentName} • {weekName}
                </span>
                {htmlReports.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase">
                    {htmlReports.length} {htmlReports.length === 1 ? 'Report' : 'Reports'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Upload or paste HTML code tendencies exported from Hudl, Catapult, or game breakdowns
              </p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToScouting && (
              <button
                type="button"
                onClick={onNavigateToScouting}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Return to standard scouting dashboard"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span>Scouting Report</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/30 active:scale-95 cursor-pointer"
              title="Upload a .html or .htm tendency file"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload HTML File</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPasteModal}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Paste raw HTML code directly"
            >
              <Code className="w-4 h-4 text-amber-400" />
              <span>Paste HTML Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      {htmlReports.length === 0 ? (
        /* Empty State & Upload Area */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-slate-850/95 backdrop-blur-md rounded-3xl border-2 border-dashed p-8 md:p-12 text-center transition-all ${
            isDragging
              ? 'border-amber-400 bg-amber-500/10 shadow-2xl scale-[1.01]'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base md:text-lg font-black text-slate-100 mb-1">
                Upload or Paste HTML Code Tendencies
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Drag and drop your exported <strong className="text-slate-200">.html</strong> tendency report here, or click to upload from your device.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/30"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Choose .html File</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPasteModal}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold border border-slate-700 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Code className="w-4 h-4 text-amber-400" />
                <span>Paste Raw HTML Code</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleGenerateFromScouting}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Or generate starter HTML tendency template from current Scouting View</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Report Viewer & Selector */
        <div
          className={`bg-slate-850/95 backdrop-blur-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-300 ${
            isFullscreen ? 'fixed inset-2 z-50 flex flex-col bg-slate-900 border-amber-500/80 shadow-2xl' : ''
          }`}
        >
          {/* Report Tabs & Controls Toolbar */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Report Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
                Reports:
              </span>
              {htmlReports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 border ${
                    selectedReportId === rep.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span className="max-w-[160px] truncate">{rep.name}</span>
                  {rep.fileSize && (
                    <span className="text-[10px] text-slate-500">({rep.fileSize})</span>
                  )}
                  {isPowerAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(rep.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5 rounded ml-1"
                      title="Delete this report"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                title="Add another HTML report"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Report</span>
              </button>
            </div>

            {/* Viewer Controls */}
            <div className="flex items-center gap-1.5 justify-end shrink-0">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 px-1 py-0.5 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(70, z - 10))}
                  disabled={zoomScale <= 70}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-bold text-[11px] min-w-[40px] text-center">
                  {zoomScale}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(130, z + 10))}
                  disabled={zoomScale >= 130}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Background Theme */}
              <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCanvasBg('paper')}
                  className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                    canvasBg === 'paper' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Light Paper Canvas"
                >
                  Paper
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasBg('dark')}
                  className={`px-2 py-1 rounded-lg font-bold text-[10px] ${
                    canvasBg === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Dark Canvas"
                >
                  Dark
                </button>
              </div>

              {/* Edit HTML Code */}
              {isPowerAdmin && (
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="p-2 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  title="Edit HTML code"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Standalone Tab */}
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-sky-300 border border-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                title="Open in new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Print */}
              <button
                type="button"
                onClick={handlePrint}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                title="Print report"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownloadReport}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                title="Download .html file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={() => setIsFullscreen((f) => !f)}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                title={isFullscreen ? 'Exit full screen' : 'Expand full screen'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Viewer Render Area */}
          <div className="flex-1 bg-slate-950">
            {activeReport ? (
              <ShadowHtmlRenderer
                html={activeReport.htmlCode || ''}
                zoomScale={zoomScale}
                canvasBg={canvasBg}
                isFullscreen={isFullscreen}
              />
            ) : (
              <div className="p-12 text-center text-slate-500">
                <p>No report selected.</p>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          {activeReport && (
            <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">{activeReport.name}</span>
                {activeReport.caption && (
                  <span className="text-slate-500 italic">— {activeReport.caption}</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                {activeReport.fileSize || ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paste / Direct HTML Code Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                <Code className="w-4 h-4" />
                <span>{isEditingExisting ? 'Edit HTML Code' : 'Paste Raw HTML Code Tendencies'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Report Title
                </label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Somers 3rd Down & Red Zone Tendencies"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Caption / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={modalCaption}
                  onChange={(e) => setModalCaption(e.target.value)}
                  placeholder="e.g. Exported from Hudl week 4 scout film"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Paste HTML Code Here
                  </label>
                  <span className="text-[10px] text-slate-500">HTML tags, tables, styling &amp; embeds supported</span>
                </div>
                <textarea
                  value={modalHtml}
                  onChange={(e) => setModalHtml(e.target.value)}
                  placeholder="<!DOCTYPE html><html><head><style>...</style></head><body>...</body></html>"
                  rows={14}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={!modalTitle.trim() || !modalHtml.trim()}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer disabled:opacity-40 transition-all shadow-md shadow-amber-600/30"
              >
                {isEditingExisting ? 'Save Changes' : 'Save Tendency Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
