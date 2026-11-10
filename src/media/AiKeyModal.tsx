// Modal dialog to view, paste, test, and save the Google Gemini API Key.
// Saved directly into local storage and used across Media photo tagging, Film Room breakdown, and Compare AI.
import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Key, Loader2, Sparkles, X } from 'lucide-react';
import {
  GEMINI_MODELS,
  getSavedGeminiKey,
  getSavedGeminiModel,
  saveGeminiKey,
  saveGeminiModel,
} from '../services/geminiFilmService';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const AiKeyModal: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [keyInput, setKeyInput] = useState(() => getSavedGeminiKey());
  const [model, setModel] = useState(() => getSavedGeminiModel());
  const [savedNote, setSavedNote] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!open) return null;

  const currentSavedKey = getSavedGeminiKey();

  const handleSave = () => {
    const trimmed = keyInput.trim();
    saveGeminiKey(trimmed);
    saveGeminiModel(model);
    setSavedNote('Gemini API key saved on this device!');
    onSaved?.();
    setTimeout(() => {
      setSavedNote('');
      if (trimmed) onClose();
    }, 1200);
  };

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim() || currentSavedKey;
    if (!keyToTest) {
      setTestResult({ ok: false, message: 'Please enter your Gemini API key.' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(keyToTest)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: OK' }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });

      if (res.ok) {
        setTestResult({ ok: true, message: 'Connection successful! Gemini API is ready.' });
        // Automatically save on successful test
        saveGeminiKey(keyToTest);
        saveGeminiModel(model);
        onSaved?.();
      } else {
        const text = await res.text();
        if (res.status === 400 || res.status === 403 || /API key not valid|API_KEY_INVALID/i.test(text)) {
          setTestResult({ ok: false, message: 'Invalid API key. Check or re-copy the key from Google AI Studio.' });
        } else if (res.status === 429) {
          setTestResult({ ok: true, message: 'Key is valid! (Note: temporary quota limit reached, will clear soon).' });
        } else {
          setTestResult({ ok: false, message: `Google error (${res.status}): ${text.slice(0, 100)}` });
        }
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Network error connecting to Gemini.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" role="dialog">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center">
              <Key size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Google Gemini AI Key
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Powers AI photo tagging, film breakdowns, and play auto-sketching
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Status info */}
          {currentSavedKey ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-bold">Active API Key Configured</p>
                <p className="font-mono text-[11px] opacity-90">{currentSavedKey.slice(0, 6)}…{currentSavedKey.slice(-4)}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No Gemini API Key Configured Yet</p>
                <p className="text-[11px]">
                  Paste your Google AI Studio API key below to unlock automated photo jersey detection and video breakdowns.
                </p>
              </div>
            </div>
          )}

          {/* Key Input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Paste Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
              >
                Get free key at Google AI Studio <ExternalLink size={11} />
              </a>
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Must start with <code className="font-mono text-indigo-600 dark:text-indigo-400">AIzaSy…</code>
            </p>
          </div>

          {/* Model Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">Gemini Vision Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Test connection feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="font-medium">{testResult.message}</span>
            </div>
          )}

          {savedNote && (
            <p className="text-emerald-600 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {savedNote}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            disabled={testing || !keyInput.trim()}
            onClick={() => void handleTestKey()}
            className="h-9 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>Test Connection</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-sm"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

