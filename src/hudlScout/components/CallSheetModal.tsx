import React, { useState } from 'react';
import { AIScoutingReport, TendencyAnalysis } from '../types/football';
import { Printer, X, Shield, AlertTriangle, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { CallSheetEdits, CallSheetSectionKey } from '../scoutBundle';

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

export const CallSheetModal: React.FC<CallSheetModalProps> = ({
  isOpen,
  onClose,
  report,
  analysis,
  opponentName,
  edits,
  onSaveEdits,
  editorName,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ sections: Record<CallSheetSectionKey, string[]>; alerts: string[]; note: string } | null>(null);

  if (!isOpen) return null;

  // What the film suggests, and what prints (the coach's edits win where they exist).
  const suggested: Record<CallSheetSectionKey, string[]> = report?.wristbandCallSheet || DEFAULT_CALLS;
  const suggestedAlerts = analysis.tells.slice(0, 4).map((t) => `${t.title.replace(/\s*Tell$/i, '')}: ${t.statEvidence}`);
  const suggestedNote = shortSummary(report?.executiveSummary);
  const linesFor = (key: CallSheetSectionKey) => edits?.sections?.[key] ?? suggested[key];
  const alerts = edits?.alerts ?? suggestedAlerts;
  const note = edits?.note ?? suggestedNote;
  const hasEdits = Boolean(edits && (Object.keys(edits.sections || {}).length || edits.alerts || edits.note !== undefined));

  const startEditing = () => {
    const sections = {} as Record<CallSheetSectionKey, string[]>;
    SECTIONS.forEach(({ key }) => (sections[key] = [...linesFor(key)]));
    setDraft({ sections, alerts: [...alerts], note });
    setEditing(true);
  };

  const isDirty = () => {
    if (!draft) return false;
    return (
      SECTIONS.some(({ key }) => !sameLines(cleanLines(draft.sections[key]), linesFor(key))) ||
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
    const nextAlerts = cleanLines(draft.alerts);
    const nextNote = draft.note.trim();
    onSaveEdits({
      sections,
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
    onSaveEdits({ sections: {}, updatedAt: Date.now(), editedBy: editorName || undefined });
    stopEditing();
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
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black">
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
                  onClick={() => window.print()}
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

        {/* Printable sheet */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 print:p-0 print:bg-white print:text-black">
          <div className="border-b-2 border-slate-900 dark:border-slate-300 print:border-black pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-700 font-bold">
                DEFENSIVE COORDINATOR GAMEPLAN
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                OPPONENT SCOUT: {opponentName.toUpperCase()}
              </h1>
            </div>
            <div className="sm:text-right text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700">
              <div>Sample: {analysis.totalPlays} Plays Analyzed</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {analysis.runPct}% Run / {analysis.passPct}% Pass · Avg {analysis.avgGainOverall} yds
              </div>
            </div>
          </div>

          {/* High-alert tells */}
          {(editing || alerts.length > 0) && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded p-2.5 text-[11px] text-amber-900 dark:text-amber-200 print:bg-amber-50 print:border-amber-300 print:text-amber-900">
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

          {/* Call boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SECTIONS.map(({ key, title, tag, wide }) => {
              const lines = linesFor(key);
              const edited = Boolean(edits?.sections?.[key]);
              return (
                <div
                  key={key}
                  className={`border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black ${wide ? 'md:col-span-2' : ''}`}
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between gap-2">
                    <span>
                      {title}
                      {!editing && edited && <span className="ml-1.5 normal-case tracking-normal font-semibold text-indigo-700 dark:text-indigo-300 print:hidden">· edited</span>}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 print:text-slate-600">{tag}</span>
                  </div>
                  {editing && draft ? (
                    <LineEditor
                      lines={draft.sections[key]}
                      onChange={(next) => setDraft({ ...draft, sections: { ...draft.sections, [key]: next } })}
                      placeholder="Front · coverage, or a coaching point"
                    />
                  ) : lines.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 italic">No calls.</p>
                  ) : (
                    <ul className={`${wide ? 'grid grid-cols-1 sm:grid-cols-3 gap-2' : 'space-y-1.5'} text-xs`}>
                      {lines.map((call, idx) => (
                        <li
                          key={idx}
                          className={`flex items-center gap-2 ${wide ? 'p-1.5' : 'p-1'} rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300`}
                        >
                          <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reminder line */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700 flex flex-col sm:flex-row sm:justify-between gap-2">
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
            <span className="shrink-0 sm:self-end">HUDLSCOUT DC CALL SHEET</span>
          </div>
        </div>
      </div>
    </div>
  );
};
