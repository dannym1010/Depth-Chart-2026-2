// The AI designer tab (only the program owner sees it): pick Claude or Gemini with your own API key (kept on this
// device), say what you want (or tap a quick start), and it sends back a plan. Read the plan, then Apply it in one
// step (Undo takes it back) or ask again.
import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Image as ImageIcon, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import type { Highlight } from '../highlights/types';
import type { MediaData } from '../media/types';
import {
  AI_PRESETS, aiBrief, applyPlan, askForPlan, CLAUDE_MODELS, GEMINI_MODELS, getClaudeKey, getGeminiKey, loadPrefs, planLines, saveClaudeKey, saveGeminiKey, savePrefs, type AiPlan, type AiPrefs, type AppliedPlan,
} from './aiDesign';
import { photoBlob } from './photoLoad';
import type { Slide } from './slideshowData';
import type { Slideshow } from './types';

interface Props {
  show: Slideshow;
  slides: Slide[];
  media: MediaData;
  highlights: Highlight[];
  roster: { num: string; name: string }[];
  teamName?: string;
  songs: { name: string; seconds: number; bpm: number; start: number }[];
  beats: number[];
  readOnly: boolean;
  onApply: (r: AppliedPlan) => void;
}

const MAX_PHOTOS = 40;

const toBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

export const AiDesignPanel: React.FC<Props> = ({ show, slides, media, highlights, roster, teamName, songs, beats, readOnly: ro, onApply }) => {
  const [prefs, setPrefsState] = useState<AiPrefs>(loadPrefs);
  const setPrefs = (p: Partial<AiPrefs>) =>
    setPrefsState((x) => {
      const n = { ...x, ...p };
      savePrefs(n);
      return n;
    });
  const [claudeKey, setClaudeKey] = useState(getClaudeKey);
  const [geminiKey, setGeminiKey] = useState(getGeminiKey);
  const [showKey, setShowKey] = useState(false);
  const [request, setRequest] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ plan: AiPlan; request: string; lines: string[] } | null>(null);
  const [applied, setApplied] = useState('');
  const [history, setHistory] = useState<{ request: string; summary: string }[]>([]);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  const claude = prefs.provider === 'claude';
  const key = claude ? claudeKey : geminiKey;
  const model = claude ? prefs.claudeModel : prefs.geminiModel;

  const ask = async () => {
    setBusy(true);
    setError('');
    setApplied('');
    setPlan(null);
    const ctl = new AbortController();
    stop.current = ctl;
    try {
      let images: [string, string][] = [];
      if (prefs.photos) {
        const photos = show.items.filter((i) => i.kind === 'photo');
        const step = Math.max(1, photos.length / MAX_PHOTOS);
        const pickList = Array.from({ length: Math.min(MAX_PHOTOS, photos.length) }, (_, k) => photos[Math.floor(k * step)]);
        let n = 0;
        for (const p of pickList) {
          if (ctl.signal.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
          setStatus(`Getting small copies of the photos (${++n} of ${pickList.length})…`);
          try {
            images.push([p.id, await toBase64(await photoBlob((p as { photoId: string }).photoId, 384))]);
          } catch {
            /* a photo Drive won't give: described only */
          }
        }
        images = images.filter(([, d]) => d.length > 100);
      }
      setStatus(claude ? 'Claude is designing… (this can take a minute)' : 'Gemini is designing…');
      const brief = aiBrief({ show, slides, media, highlights, roster, teamName, songs, beats });
      const p = await askForPlan({ provider: prefs.provider, key, model, request, standing: prefs.standing, brief, images, history, signal: ctl.signal });
      setPlan({ plan: p, request, lines: planLines(p, show) });
      setStatus('');
    } catch (err: any) {
      setStatus('');
      setError(err?.name === 'AbortError' ? 'Stopped.' : err?.message || String(err));
    } finally {
      setBusy(false);
      stop.current = null;
    }
  };

  const apply = () => {
    if (!plan || ro) return;
    const r = applyPlan(show, plan.plan);
    onApply(r);
    setHistory((h) => [...h, { request: plan.request || '(no words)', summary: plan.plan.summary.slice(0, 300) }].slice(-6));
    setApplied(`Applied: ${r.changes.join(' · ') || 'nothing changed'}. Undo takes it all back.`);
    setPlan(null);
    setRequest('');
  };

  const input = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs min-w-0';
  const pill = (on: boolean) => `h-8 px-3 rounded-lg text-xs font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-start gap-2 rounded-lg bg-gradient-to-br from-indigo-50 to-fuchsia-50 dark:from-indigo-500/10 dark:to-fuchsia-500/10 p-2.5">
        <Sparkles size={16} className="text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5" />
        <span className="text-slate-700 dark:text-slate-200">
          <b>AI designer.</b> Tell it what you want: it plans the order, times, fades, looks, words, title cards and photo spots, and you apply it in one step. Only your account sees this; your keys stay on this device.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={pill(claude)} aria-pressed={claude} onClick={() => setPrefs({ provider: 'claude' })}>
            Claude
          </button>
          <button type="button" className={pill(!claude)} aria-pressed={!claude} onClick={() => setPrefs({ provider: 'gemini' })}>
            Gemini
          </button>
          <select value={model} onChange={(e) => setPrefs(claude ? { claudeModel: e.target.value } : { geminiModel: e.target.value })} className={`${input} flex-1`} aria-label="Model">
            {(claude ? CLAUDE_MODELS : GEMINI_MODELS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              const v = e.target.value;
              if (claude) {
                setClaudeKey(v);
                saveClaudeKey(v);
              } else {
                setGeminiKey(v);
                saveGeminiKey(v);
              }
            }}
            placeholder={claude ? 'Claude API key (sk-ant-…)' : 'Gemini API key'}
            className={`${input} flex-1 font-mono`}
            autoComplete="off"
            spellCheck={false}
            aria-label={claude ? 'Claude API key' : 'Gemini API key'}
          />
          <button type="button" onClick={() => setShowKey((s) => !s)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600" aria-label={showKey ? 'Hide the key' : 'Show the key'}>
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <span className="text-[11px] text-slate-500">
          {claude ? 'Get a key at console.anthropic.com → API keys (billed to your Anthropic account).' : 'Get a key at aistudio.google.com → Get API key (the same key Media’s AI tagging uses).'}
        </span>
      </div>

      <details className="rounded-lg border border-slate-200 dark:border-slate-800 p-2" open={!prefs.standing}>
        <summary className="font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Always keep in mind {prefs.standing ? '(set)' : ''}</summary>
        <textarea
          value={prefs.standing}
          onChange={(e) => setPrefs({ standing: e.target.value })}
          rows={3}
          placeholder="e.g. We’re the Mahopac 10U Indians. Families watch this at the banquet. Keep words short and positive; first names only."
          className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-2 text-xs"
          aria-label="Instructions it always keeps in mind"
        />
      </details>

      <div className="flex flex-col gap-1.5">
        <span className="font-bold text-slate-700 dark:text-slate-200">What should it do?</span>
        <div className="flex flex-wrap gap-1">
          {AI_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setRequest(p.text)} className="h-7 px-2 rounded-full border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400">
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={4}
          placeholder={history.length ? 'Ask for more changes (e.g. “make the ending slower”)…' : 'e.g. Put the photos in game order with a title card before each game, slow down for the last game, and end on the team photo.'}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-2 text-xs"
          aria-label="What the AI should do"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !busy && key) void ask();
          }}
        />
        <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={prefs.photos} onChange={(e) => setPrefs({ photos: e.target.checked })} />
          <ImageIcon size={12} /> Let it look at the photos (small copies of up to {MAX_PHOTOS}; slower, costs more)
        </label>
        <div className="flex items-center gap-2">
          {busy ? (
            <button type="button" onClick={() => stop.current?.abort()} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Stop
            </button>
          ) : (
            <button type="button" onClick={() => void ask()} disabled={!key.trim() || ro || !show.items.length} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-black inline-flex items-center gap-1.5 disabled:opacity-40">
              <Wand2 size={14} /> Ask {claude ? 'Claude' : 'Gemini'}
            </button>
          )}
          {status && <span className="text-[11px] text-slate-500">{status}</span>}
        </div>
        {!show.items.length && <span className="text-[11px] text-slate-500">Add some photos or clips first.</span>}
        {error && <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{error}</span>}
        {applied && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{applied}</span>}
      </div>

      {plan && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 p-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600 dark:text-indigo-300" />
            <b className="text-slate-800 dark:text-slate-100">The plan</b>
            <button type="button" onClick={() => setPlan(null)} className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Throw the plan away">
              <X size={14} />
            </button>
          </div>
          {plan.plan.summary && <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{plan.plan.summary}</p>}
          {plan.lines.length > 0 ? (
            <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300">
              {plan.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500">It didn’t suggest any changes.</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={apply} disabled={ro || !plan.lines.length} className="h-9 px-4 rounded-lg bg-emerald-600 text-white font-black disabled:opacity-40">
              Apply it
            </button>
            <button type="button" onClick={() => void ask()} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold">
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
