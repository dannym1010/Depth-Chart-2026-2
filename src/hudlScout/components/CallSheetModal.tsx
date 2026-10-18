import React, { useEffect, useRef, useState } from 'react';
import { AIScoutingReport, TendencyAnalysis } from '../types/football';
import { Printer, X, Shield, AlertTriangle, Pencil, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { CallSheetEdits, CallSheetSectionKey } from '../scoutBundle';
import { resolveDiagram } from '../../utils/playDiagrams';
import { SheetPrintPanel, type FormationPrintChange, type TheirPlayChange } from './SheetPrintPanel';
import { defenseSheetHtml, loadSheetOptions, saveSheetOptions, sortPlayTypes, type SheetPrintOptions } from '../utils/defenseSheetPrint';

/** One of their play types, with our defense drawn against it, for the printed report. */
export interface ReportPlayType {
  key: string;
  label: string;
  detail: string;
  diagram?: string;
  /** Its plays (each name once, with every card's id), whether each prints, and each one's coaching point. */
  plays: { name: string; ids: string[]; hidden: boolean; point?: string; onReport?: boolean }[];
  /** Run or pass (most of its plays). */
  kind: 'run' | 'pass';
}

interface CallSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AIScoutingReport | null;
  analysis: TendencyAnalysis;
  opponentName: string;
  /** Coach edits saved with this week's report; missing parts follow the film. */
  edits?: CallSheetEdits;
  /** When given, the sheet shows an Edit button. */
  onSaveEdits?: (edits: CallSheetEdits) => void;
  editorName?: string;
  /** Their play types on this week's report, each drawn against our defense. Printed on its own page. */
  playTypes?: ReportPlayType[];
  /** The same plays, one card each (the play page shows these unless the coach combines same plays). */
  playSingles?: ReportPlayType[];
  /** Our calls against each of their formations (base + situations), with the picture of our defense vs it. */
  formationPlans?: {
    id?: string;
    name: string;
    printSkip?: boolean;
    lines: { situation: string; call: string }[];
    /** The coach's game plan notes for it. */
    notes?: string;
    /** Their plays from it (every card id by that name), and whether each prints. */
    plays?: { name: string; ids: string[]; hidden: boolean; point?: string }[];
    theirPlays?: { name: string; point?: string }[];
    diagram?: string;
  }[];
  /** Print a formation or leave it off; print one of its plays or leave it off (saved on the formation). */
  onFormationPrint?: (id: string, change: FormationPrintChange) => void;
  /** Print one of their plays on the play page or leave it off; its coaching point. */
  onTheirPlay?: (change: TheirPlayChange) => void;
}

const SECTIONS: { key: CallSheetSectionKey; title: string; tag: string; wide?: boolean }[] = [
  { key: 'firstDownCalls', title: '1st & 10 Base Calls', tag: 'NORMAL DOWNS' },
  { key: 'runStopCalls', title: 'Run Plugs & Short Yardage', tag: 'HEAVY FRONTS' },
  { key: 'thirdDownMustStops', title: '3rd Down Money Down Menu', tag: 'CONVERSION DEFENSE' },
  { key: 'passBlitzCalls', title: 'Pass Blitz & Fire Zones', tag: 'PRESSURE ATTACK' },
  { key: 'redZoneLocks', title: 'Red Zone (Inside 20) & Goal Line Locks', tag: 'SCORING DEFENSE', wide: true },
];

// Used only when there is no film yet.
const DEFAULT_CALLS: Record<CallSheetSectionKey, string[]> = {
  firstDownCalls: ['Over Front · Cover 4 Quarters', 'Under Front · Cover 3 Sky', 'Base 4-2-5 · 2-High Read'],
  runStopCalls: ['Bear Front · 8-Man Box (Plug A-Gaps)', 'Will Backer A-Gap Fire', 'Pinch Tackles · Spill Outside'],
  passBlitzCalls: ['Boundary Edge Corner Cat Blitz', 'Cross-Dog LB Inside A-Gap', '5-Man Fire Zone (Under 3-Deep)'],
  thirdDownMustStops: ['3rd & Short: Goal Line 5-2 Plug', '3rd & Med: Cover 2 Man-Under', '3rd & Long: 3-Man Rush Dime / Drop 8'],
  redZoneLocks: ['Goal Line 6-2 Heavy', 'Bracket Slot #1 Receiver', 'Press Bail Cover 1 Hole'],
};

const MAX_LINES = 8;

/** First sentence or two of the summary, cut at a sentence end rather than mid-word. */
function shortSummary(text?: string): string {
  if (!text) return 'Keep gap integrity on boundary runs. Do not bite on play-action on 2nd & short.';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > 220 && out) break;
    out += s;
  }
  return out.trim();
}

const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const cleanLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);
/** The boxes a coach added, without blank lines; a box with no name and no calls is dropped. */
const cleanCustom = (list: { id: string; title: string; lines: string[] }[]) =>
  list.map((c) => ({ id: c.id, title: c.title.trim(), lines: cleanLines(c.lines) })).filter((c) => c.title || c.lines.length);

const inputClass =
  'flex-1 min-w-0 rounded px-2 py-1.5 text-xs font-semibold bg-white text-slate-900 border border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 focus:outline-none focus:border-indigo-500';

/** Editable list of lines with remove buttons and an Add line button. */
const LineEditor: React.FC<{ lines: string[]; onChange: (lines: string[]) => void; placeholder: string }> = ({ lines, onChange, placeholder }) => (
  <div className="space-y-1.5">
    {lines.map((line, idx) => (
      <div key={idx} className="flex items-center gap-1.5">
        <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold text-xs">{idx + 1}.</span>
        <input
          value={line}
          onChange={(e) => onChange(lines.map((l, i) => (i === idx ? e.target.value : l)))}
          placeholder={placeholder}
          className={inputClass}
          aria-label={`Line ${idx + 1}`}
        />
        <button
          type="button"
          onClick={() => onChange(lines.filter((_, i) => i !== idx))}
          className="p-2 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-slate-800 cursor-pointer"
          title="Remove line"
          aria-label={`Remove line ${idx + 1}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    {lines.length < MAX_LINES && (
      <button
        type="button"
        onClick={() => onChange([...lines, ''])}
        className="min-h-[32px] flex items-center gap-1 px-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Add line
      </button>
    )}
  </div>
);

/** The printed page, shown as it prints: paper width, scaled down to fit the window. */
const PagePreview: React.FC<{ html: string; landscape: boolean }> = ({ html, landscape }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(1056);
  const pageWidth = (landscape ? 11 : 8.5) * 96;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = width ? Math.min(1, width / pageWidth) : 1;
  return (
    <div ref={wrap} className="w-full">
      <div style={{ height: height * scale, width: pageWidth * scale }} className="mx-auto shadow-lg">
        <iframe
          ref={frame}
          title="Print preview"
          srcDoc={html}
          onLoad={() => {
            const doc = frame.current?.contentDocument;
            if (doc) setHeight(doc.documentElement.scrollHeight);
          }}
          style={{ width: pageWidth, height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block' }}
        />
      </div>
    </div>
  );
};

export const CallSheetModal: React.FC<CallSheetModalProps> = ({
  isOpen,
  onClose,
  report,
  analysis,
  opponentName,
  edits,
  onSaveEdits,
  editorName,
  playTypes: combinedTypes,
  playSingles,
  formationPlans,
  onFormationPrint,
  onTheirPlay,
}) => {
  const [editing, setEditing] = useState(false);
  // What prints and how (kept on this device).
  const [printOpts, setPrintOpts] = useState<SheetPrintOptions>(loadSheetOptions);
  const [optsOpen, setOptsOpen] = useState(false);
  const [printNote, setPrintNote] = useState('');
  const changeOpts = (next: SheetPrintOptions) => {
    setPrintOpts(next);
    saveSheetOptions(next);
  };
  const [draft, setDraft] = useState<{
    sections: Record<CallSheetSectionKey, string[]>;
    titles: Record<CallSheetSectionKey, string>;
    custom: { id: string; title: string; lines: string[] }[];
    alerts: string[];
    note: string;
  } | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  // Their plays page: each play on its own card, or plays of the same type combined.
  const playTypes = printOpts.playTypeCombine || !playSingles ? combinedTypes : playSingles;
  const diagrams = useRef(new Map<string, Promise<string | null>>());

  // What the film suggests, and what prints (the coach's edits win where they exist).
  const suggested: Record<CallSheetSectionKey, string[]> = report?.wristbandCallSheet || DEFAULT_CALLS;
  const suggestedAlerts = (analysis?.tells || []).slice(0, 4).map((t) => `${t.title.replace(/\s*Tell$/i, '')}: ${t.statEvidence}`);
  const suggestedNote = shortSummary(report?.executiveSummary);
  const linesFor = (key: CallSheetSectionKey) => edits?.sections?.[key] ?? suggested[key];
  const alerts = edits?.alerts ?? suggestedAlerts;
  const note = edits?.note ?? suggestedNote;
  const hasEdits = Boolean(
    edits && (Object.keys(edits.sections || {}).length || Object.keys(edits.titles || {}).length || edits.custom?.length || edits.alerts || edits.note !== undefined)
  );
  const titleFor = (key: CallSheetSectionKey) => edits?.titles?.[key]?.trim() || SECTIONS.find((x) => x.key === key)?.title || '';
  // Every box that prints: ours (with the coach's names), then the ones the coach added.
  const allSections = [
    ...SECTIONS.map(({ key, tag, wide }) => ({ key: key as string, title: titleFor(key), tag, wide, lines: linesFor(key) })),
    ...(edits?.custom || []).map((c) => ({ key: c.id, title: c.title, tag: '', wide: false, lines: c.lines })),
  ];

  // The page that prints (the preview shows this same page).
  const sheetHtml = async () => {
    const picture = async (url?: string | null) => {
      if (!url) return undefined;
      if (!diagrams.current.has(url)) diagrams.current.set(url, resolveDiagram(url));
      return (await diagrams.current.get(url)) || undefined;
    };
    const types = printOpts.playTypes && playTypes?.length
      ? await Promise.all(
          sortPlayTypes(playTypes.filter((t) => t.plays.some((p) => !p.hidden)), printOpts.playTypeSort)
            .map(async (t) => ({
              kind: t.kind,
              label: t.label,
              detail: t.detail,
              diagram: printOpts.playTypePicture ? await picture(t.diagram) : undefined,
              points: t.plays.filter((p) => !p.hidden && p.point).map((p) => ({ name: p.name, point: p.point || '' })),
            }))
        )
      : [];
    return defenseSheetHtml(
      {
        opponentName,
        stats: { totalPlays: analysis.totalPlays, runPct: analysis.runPct, passPct: analysis.passPct, avgGain: analysis.avgGainOverall },
        alerts,
        sections: allSections,
        note,
        playTypes: types,
        formationPlans: printOpts.formationPlans && formationPlans?.length
          ? await Promise.all(
              formationPlans
                .filter((f) => !f.printSkip)
                .map(async (f) => ({ name: f.name, lines: f.lines, theirPlays: f.theirPlays, notes: f.notes, diagram: printOpts.formationPicture ? await picture(f.diagram) : undefined }))
            )
          : [],
      },
      printOpts
    );
  };

  useEffect(() => {
    if (!isOpen || editing) return;
    let live = true;
    const t = setTimeout(() => void sheetHtml().then((html) => live && setPreviewHtml(html)), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing, printOpts, edits, report, analysis, opponentName, playTypes, formationPlans]);

  if (!isOpen) return null;

  const startEditing = () => {
    const sections = {} as Record<CallSheetSectionKey, string[]>;
    const titles = {} as Record<CallSheetSectionKey, string>;
    SECTIONS.forEach(({ key }) => {
      sections[key] = [...linesFor(key)];
      titles[key] = titleFor(key);
    });
    setDraft({ sections, titles, custom: (edits?.custom || []).map((c) => ({ ...c, lines: [...c.lines] })), alerts: [...alerts], note });
    setEditing(true);
  };

  const isDirty = () => {
    if (!draft) return false;
    return (
      SECTIONS.some(({ key }) => !sameLines(cleanLines(draft.sections[key]), linesFor(key)) || draft.titles[key].trim() !== titleFor(key)) ||
      JSON.stringify(cleanCustom(draft.custom)) !== JSON.stringify(edits?.custom || []) ||
      !sameLines(cleanLines(draft.alerts), alerts) ||
      draft.note.trim() !== note
    );
  };

  const stopEditing = () => {
    setEditing(false);
    setDraft(null);
  };

  const cancelEditing = () => {
    if (isDirty() && !window.confirm('Discard your changes to the call sheet?')) return;
    stopEditing();
  };

  // Store only what differs from the film's suggestion, so untouched parts keep updating.
  const saveEdits = () => {
    if (!draft || !onSaveEdits) return;
    const sections: Partial<Record<CallSheetSectionKey, string[]>> = {};
    SECTIONS.forEach(({ key }) => {
      const lines = cleanLines(draft.sections[key]);
      if (!sameLines(lines, suggested[key])) sections[key] = lines;
    });
    const titles: Partial<Record<CallSheetSectionKey, string>> = {};
    SECTIONS.forEach(({ key, title }) => {
      const t = draft.titles[key].trim();
      if (t && t !== title) titles[key] = t;
    });
    const custom = cleanCustom(draft.custom);
    const nextAlerts = cleanLines(draft.alerts);
    const nextNote = draft.note.trim();
    onSaveEdits({
      sections,
      ...(Object.keys(titles).length ? { titles } : {}),
      ...(custom.length ? { custom } : {}),
      alerts: sameLines(nextAlerts, suggestedAlerts) ? undefined : nextAlerts,
      note: nextNote === suggestedNote ? undefined : nextNote,
      updatedAt: Date.now(),
      editedBy: editorName || undefined,
    });
    stopEditing();
  };

  const resetToSuggested = () => {
    if (!onSaveEdits) return;
    if (!window.confirm('Replace the edited calls with the suggestions from the film?')) return;
    // Your own boxes and box names stay.
    onSaveEdits({ sections: {}, titles: edits?.titles, custom: edits?.custom, updatedAt: Date.now(), editedBy: editorName || undefined });
    stopEditing();
  };

  const printSheet = async () => {
    setPrintNote('');
    const html = await sheetHtml();
    const win = window.open('', '_blank');
    if (!win) {
      setPrintNote('Allow pop-ups to print the call sheet.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Wait for the pictures, so the first print isn't missing them.
    await Promise.all(
      Array.from(win.document.images).map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = () => res(null); })))
    );
    setTimeout(() => win.print(), 150);
  };

  const close = () => {
    if (editing && isDirty() && !window.confirm('Discard your changes to the call sheet?')) return;
    stopEditing();
    onClose();
  };

  const editedLabel =
    hasEdits && edits?.updatedAt
      ? `Edited${edits.editedBy ? ` by ${edits.editedBy}` : ''} ${new Date(edits.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
      : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-full ${editing ? 'max-w-4xl max-h-[96vh]' : 'max-w-7xl h-[96vh]'} flex flex-col shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black`}>
        {/* Action header (hidden when printing) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{editing ? 'Editing the call sheet' : 'Sideline Defensive Call Sheet'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editing
                  ? 'Change, add, or remove lines. Saved for every coach on this week’s report.'
                  : editedLabel || 'Suggested from the film. Edit it to make it yours.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                {hasEdits && (
                  <button
                    type="button"
                    onClick={resetToSuggested}
                    className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset to suggested
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdits}
                  className="min-h-[36px] px-3.5 py-1.5 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white cursor-pointer"
                >
                  Save changes
                </button>
              </>
            ) : (
              <>
                {onSaveEdits && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit calls
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOptsOpen((v) => !v)}
                  aria-pressed={optsOpen}
                  className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border cursor-pointer ${
                    optsOpen
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Print options
                </button>
                <button
                  type="button"
                  onClick={() => void printSheet()}
                  className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Call Sheet</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close call sheet"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {printNote && <p className="px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 print:hidden">{printNote}</p>}

        {!editing ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {optsOpen && (
              <aside className="shrink-0 lg:w-[380px] max-h-[45%] lg:max-h-none overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <SheetPrintPanel
                  options={printOpts}
                  onChange={changeOpts}
                  sections={allSections.map(({ key, title }) => ({ key, title }))}
                  playTypeCount={playTypes?.length || 0}
                  formationPlanCount={formationPlans?.length || 0}
                  formations={formationPlans}
                  onFormationPrint={onFormationPrint}
                  playTypes={playTypes ? sortPlayTypes(playTypes, printOpts.playTypeSort) : undefined}
                  onTheirPlay={onTheirPlay}
                />
              </aside>
            )}
            {/* The preview is the printout: what you see here is what prints. */}
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-300 dark:bg-slate-800">
              {previewHtml ? (
                <PagePreview html={previewHtml} landscape={printOpts.orientation === 'landscape'} />
              ) : (
                <p className="p-6 text-center text-xs font-bold text-slate-600 dark:text-slate-300">Building the preview…</p>
              )}
            </div>
          </div>
        ) : (
        /* Editing the calls */
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 print:p-0 print:bg-white print:text-black">
          <div className="border-b-2 border-slate-900 dark:border-slate-300 print:border-black pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className={!printOpts.title ? 'opacity-35' : ''}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-700 font-bold">
                DEFENSIVE COORDINATOR GAMEPLAN
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                OPPONENT SCOUT: {opponentName.toUpperCase()}
              </h1>
            </div>
            <div className={`sm:text-right text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700 ${!printOpts.stats ? 'opacity-35' : ''}`}>
              <div>Sample: {analysis.totalPlays} Plays Analyzed</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {analysis.runPct}% Run / {analysis.passPct}% Pass · Avg {analysis.avgGainOverall} yds
              </div>
            </div>
          </div>

          {/* High-alert tells */}
          {(editing || alerts.length > 0) && (
            <div className={`bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded p-2.5 text-[11px] text-amber-900 dark:text-amber-200 print:bg-amber-50 print:border-amber-300 print:text-amber-900 ${!printOpts.alerts && !editing ? 'opacity-35' : ''}`}>
              <div className="font-bold flex items-center gap-1 mb-1.5 text-amber-800 dark:text-amber-300 print:text-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>HIGH-ALERT SIDELINE TELLS:</span>
                {!editing && edits?.alerts && <span className="ml-1 font-semibold normal-case print:hidden">(edited)</span>}
              </div>
              {editing && draft ? (
                <LineEditor
                  lines={draft.alerts}
                  onChange={(lines) => setDraft({ ...draft, alerts: lines })}
                  placeholder="e.g. Motion to the boundary = sweep"
                />
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 list-disc list-inside">
                  {alerts.map((line, idx) => {
                    const split = line.indexOf(':');
                    return (
                      <li key={idx}>
                        {split > 0 ? (
                          <>
                            <strong>{line.slice(0, split)}:</strong>
                            {line.slice(split + 1)}
                          </>
                        ) : (
                          line
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Call boxes: rename any box; add your own (they print after these) */}
          {draft && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SECTIONS.map(({ key, title, tag, wide }) => (
                <div key={key} className={`border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 ${wide ? 'md:col-span-2' : ''}`}>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2 flex items-center justify-between gap-2">
                    <input
                      value={draft.titles[key]}
                      onChange={(e) => setDraft({ ...draft, titles: { ...draft.titles, [key]: e.target.value } })}
                      placeholder={title}
                      aria-label={`Name of the ${title} box`}
                      className={`${inputClass} font-black uppercase tracking-wider`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{tag}</span>
                  </div>
                  <LineEditor
                    lines={draft.sections[key]}
                    onChange={(next) => setDraft({ ...draft, sections: { ...draft.sections, [key]: next } })}
                    placeholder="Front · coverage, or a coaching point"
                  />
                </div>
              ))}
              {draft.custom.map((c, i) => {
                const setCustom = (patch: Partial<typeof c>) => setDraft({ ...draft, custom: draft.custom.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={c.id} className="border-2 border-dashed border-teal-300 dark:border-teal-700 rounded p-3 bg-white dark:bg-slate-900/60">
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2 flex items-center gap-2">
                      <input
                        value={c.title}
                        onChange={(e) => setCustom({ title: e.target.value })}
                        placeholder="Name this box (e.g. Sudden change, Trick plays)"
                        aria-label={`Name of your box ${i + 1}`}
                        className={`${inputClass} font-black uppercase tracking-wider`}
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, custom: draft.custom.filter((_, j) => j !== i) })}
                        className="p-2 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-300 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                        title="Remove this box"
                        aria-label={`Remove the box ${c.title || i + 1}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <LineEditor lines={c.lines} onChange={(lines) => setCustom({ lines })} placeholder="A call, or a coaching point" />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, custom: [...draft.custom, { id: `custom-${Date.now().toString(36)}`, title: '', lines: [''] }] })}
                className="min-h-[96px] rounded border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add your own box
              </button>
            </div>
          )}

          {/* Reminder line */}
          <div className={`pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700 flex flex-col sm:flex-row sm:justify-between gap-2 ${!printOpts.note && !editing ? 'opacity-35' : ''}`}>
            {editing && draft ? (
              <label className="flex-1 flex flex-col gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-200">Reminder at the bottom of the sheet</span>
                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  rows={2}
                  className="w-full rounded px-2 py-1.5 text-xs bg-white text-slate-900 border border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </label>
            ) : (
              <span>{note}</span>
            )}
            <span className="shrink-0 sm:self-end">DEFENSIVE CALL SHEET</span>
          </div>

        </div>
        )}
      </div>
    </div>
  );
};
