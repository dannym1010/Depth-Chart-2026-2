// The team's highlight look and defaults (shared: one copy for the staff), where highlights are kept (the staff's
// cloud copy, or this computer only), and the local library folder with its highlights.json.
import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Save, Upload } from 'lucide-react';
import { drawCard, drawLowerThird, FONTS, loadImage } from './graphics';
import { setSettings } from './highlightData';
import { canWriteFolders, DB_FILE, dbJson, libraryFolder, parseDb, pickLibrary, readText, subfolder, writeFile } from './localLibrary';
import type { HighlightSettings, HighlightsData } from './types';
import type { HighlightStore } from './useHighlights';

interface Props {
  store: HighlightStore;
  teamName: string;
  season: string;
  onImport: (d: Partial<HighlightsData>) => void;
}

export const AUTO_JSON_KEY = 'footballHighlightsAutoJson';

export const SettingsPanel: React.FC<Props> = ({ store, teamName, season, onImport }) => {
  const s = store.data.settings;
  const ro = store.readOnly;
  const set = (patch: Partial<HighlightSettings>) => !ro && store.update((d) => setSettings(d, patch));
  const [lib, setLib] = useState<{ name: string; ok: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_JSON_KEY) !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    void libraryFolder().then(({ handle, ok }) => setLib(handle ? { name: handle.name, ok } : null));
  }, []);

  // A preview of the look: a title card and a highlight title.
  const cardRef = useRef<HTMLCanvasElement>(null);
  const lowerRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let off = false;
    void loadImage(s.logo).then((logo) => {
      if (off) return;
      for (const [ref, kind] of [[cardRef, 'card'], [lowerRef, 'lower']] as const) {
        const c = ref.current;
        if (!c) continue;
        c.width = 640;
        c.height = 360;
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, 640, 360);
        if (kind === 'card') drawCard(ctx, 640, 360, { kind: 'intro', title: `${teamName} vs Shrub Oak`, sub: 'Week 3' }, s, logo);
        else {
          const g = ctx.createLinearGradient(0, 0, 640, 360);
          g.addColorStop(0, '#2f6b2f');
          g.addColorStop(1, '#1d4a1d');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 640, 360);
          drawLowerThird(ctx, 640, 360, { title: '45-yd TD run', sub: s.names === 'none' ? undefined : s.names === 'number' ? '#21' : s.names === 'full' ? '#21 Nash Ward' : '#21 Nash' }, s, logo);
        }
      }
    });
    return () => {
      off = true;
    };
  }, [s, teamName]);

  const onLogo = async (file?: File) => {
    if (!file) return;
    // Kept small (it's shared with the staff): 256 pixels at most.
    const img = await loadImage(URL.createObjectURL(file));
    if (!img) return setNote("That picture couldn't be read.");
    const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    set({ logo: c.toDataURL('image/png') });
  };

  const saveJson = async (ask: boolean) => {
    const { handle, ok } = await libraryFolder(ask);
    if (!handle || !ok) return setNote('Pick the highlights folder first.');
    await writeFile(handle, DB_FILE, dbJson(store.data, teamName, season));
    await subfolder(handle, ['Music']);
    setNote(`Saved ${DB_FILE} in “${handle.name}”.`);
  };
  const readJson = async () => {
    const { handle, ok } = await libraryFolder(true);
    if (!handle || !ok) return setNote('Pick the highlights folder first.');
    const text = await readText(handle, DB_FILE);
    const d = text ? parseDb(text) : null;
    if (!d) return setNote(`No ${DB_FILE} in “${handle.name}” (or it can't be read).`);
    onImport(d);
    setNote(`Read ${d.highlights?.length || 0} highlights and ${d.reels?.length || 0} reels from ${DB_FILE} (merged with these).`);
  };

  const row = 'flex flex-wrap items-center gap-2 text-xs';
  const label = 'w-32 text-slate-600 dark:text-slate-300';
  const sel = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs';
  const num = (k: keyof HighlightSettings, min: number, max: number, step: number) => (
    <input type="number" min={min} max={max} step={step} value={Number(s[k])} disabled={ro} onChange={(e) => set({ [k]: Math.min(max, Math.max(min, Number(e.target.value) || min)) } as Partial<HighlightSettings>)} className={`${sel} w-20`} />
  );
  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2.5';

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className={panel} aria-label="Look">
        <h3 className="font-black text-slate-900 dark:text-slate-100">Look</h3>
        <div className="grid grid-cols-2 gap-2">
          <canvas ref={cardRef} className="w-full rounded-lg" style={{ aspectRatio: '16 / 9' }} aria-label="Title card preview" />
          <canvas ref={lowerRef} className="w-full rounded-lg" style={{ aspectRatio: '16 / 9' }} aria-label="Title preview" />
        </div>
        <div className={row}>
          <span className={label}>Colors</span>
          {(['primary', 'accent', 'text'] as const).map((k) => (
            <label key={k} className="inline-flex items-center gap-1">
              <input type="color" value={s[k]} disabled={ro} onChange={(e) => set({ [k]: e.target.value })} aria-label={k === 'primary' ? 'Main color' : k === 'accent' ? 'Second color' : 'Text color'} />
              {k === 'primary' ? 'Main' : k === 'accent' ? 'Second' : 'Text'}
            </label>
          ))}
        </div>
        <div className={row}>
          <span className={label}>Logo</span>
          <label className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold cursor-pointer">
            <Upload size={12} /> {s.logo ? 'Change' : 'Add a PNG'}
            <input type="file" accept="image/*" className="hidden" disabled={ro} onChange={(e) => void onLogo(e.target.files?.[0])} />
          </label>
          {s.logo && (
            <>
              <select value={s.logoCorner} disabled={ro} onChange={(e) => set({ logoCorner: e.target.value as HighlightSettings['logoCorner'] })} className={sel} aria-label="Logo corner">
                <option value="tr">Top right</option>
                <option value="tl">Top left</option>
                <option value="br">Bottom right</option>
                <option value="bl">Bottom left</option>
              </select>
              <button type="button" disabled={ro} onClick={() => set({ logo: undefined })} className="text-rose-600 dark:text-rose-400 font-bold">Remove</button>
            </>
          )}
        </div>
        <div className={row}>
          <span className={label}>Font</span>
          <select value={s.font} disabled={ro} onChange={(e) => set({ font: e.target.value })} className={sel}>
            {FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className={row}>
          <span className={label}>Title style</span>
          <select value={s.titleStyle} disabled={ro} onChange={(e) => set({ titleStyle: e.target.value as HighlightSettings['titleStyle'] })} className={sel}>
            <option value="bar">Bar</option>
            <option value="box">Box</option>
            <option value="strip">Broadcast strip</option>
            <option value="plain">Plain text</option>
          </select>
        </div>
        <div className={row}>
          <span className={label}>Names on screen</span>
          <select value={s.names} disabled={ro} onChange={(e) => set({ names: e.target.value as HighlightSettings['names'] })} className={sel}>
            <option value="first">Number + first name</option>
            <option value="full">Number + full name</option>
            <option value="number">Number only</option>
            <option value="none">None</option>
          </select>
        </div>
      </section>

      <section className={panel} aria-label="Defaults">
        <h3 className="font-black text-slate-900 dark:text-slate-100">Trims and sound</h3>
        <div className={row}>
          <span className={label}>Before the snap</span>
          {num('preRoll', 0, 10, 0.5)} s
        </div>
        <div className={row}>
          <span className={label}>After the snap</span>
          {num('postRoll', 2, 20, 0.5)} s
        </div>
        <div className={row}>
          <span className={label}>Slow motion</span>
          <select value={s.slowSpeed} disabled={ro} onChange={(e) => set({ slowSpeed: Number(e.target.value) })} className={sel}>
            <option value={0.5}>½ speed</option>
            <option value={0.25}>¼ speed</option>
          </select>
          <span className="text-slate-500">Replays</span>
          <select value={s.replaySpeed} disabled={ro} onChange={(e) => set({ replaySpeed: Number(e.target.value) })} className={sel}>
            <option value={1}>Full speed</option>
            <option value={0.5}>½ speed</option>
            <option value={0.25}>¼ speed</option>
          </select>
        </div>
        <div className={row}>
          <span className={label}>Game sound</span>
          <select value={s.gameSound} disabled={ro} onChange={(e) => set({ gameSound: e.target.value as HighlightSettings['gameSound'] })} className={sel}>
            <option value="low">Low (under music)</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        <h3 className="font-black text-slate-900 dark:text-slate-100 pt-1">Output</h3>
        <div className={row}>
          <span className={label}>Shape</span>
          <select value={s.shape} disabled={ro} onChange={(e) => set({ shape: e.target.value as HighlightSettings['shape'] })} className={sel}>
            <option value="16:9">16:9 (TV, YouTube)</option>
            <option value="9:16">9:16 vertical (Instagram, TikTok)</option>
            <option value="1:1">1:1 square</option>
          </select>
        </div>
        <div className={row}>
          <span className={label}>Size</span>
          <select value={s.size} disabled={ro} onChange={(e) => set({ size: e.target.value as HighlightSettings['size'] })} className={sel}>
            <option value="2160">4K</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
          </select>
          <span className="text-slate-500">Frames</span>
          <select value={s.fps} disabled={ro} onChange={(e) => set({ fps: Number(e.target.value) as 30 | 60 })} className={sel}>
            <option value={30}>30 (smooth ½-speed slow motion)</option>
            <option value={60}>60</option>
          </select>
        </div>
        <div className={row}>
          <span className={label}>Export as</span>
          <select value={s.exportFormat} disabled={ro} onChange={(e) => set({ exportFormat: e.target.value as HighlightSettings['exportFormat'] })} className={sel}>
            <option value="fcpxml">FCPXML (Resolve, Final Cut)</option>
            <option value="xmeml">FCP7 XML (Premiere, Resolve)</option>
            <option value="edl">EDL</option>
            <option value="otio">OTIO</option>
          </select>
        </div>
        <h3 className="font-black text-slate-900 dark:text-slate-100 pt-1">Suggestions and the banquet</h3>
        <div className={row}>
          <span className={label}>Big gain</span>
          {num('bigGain', 5, 60, 1)} yards or more
        </div>
        <div className={row}>
          <span className={label}>Every kid</span>
          at least {num('minPerKid', 1, 20, 1)} highlights
        </div>
      </section>

      <section className={`${panel} lg:col-span-2`} aria-label="Where highlights are kept">
        <h3 className="font-black text-slate-900 dark:text-slate-100">Where highlights are kept</h3>
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="inline-flex items-start gap-2">
            <input type="radio" name="hl-where" checked={!store.localOnly} disabled={ro} onChange={() => {
              store.setLocalOnly(false);
              // Send what this computer has to the staff copy (merged with theirs).
              window.setTimeout(() => store.update((d) => d), 50);
            }} className="mt-0.5" />
            <span>
              <b>Shared with the staff</b> (any coach can mark plays, from an iPad too). Only the list and the trims are shared, never the film.
            </span>
          </label>
          <label className="inline-flex items-start gap-2">
            <input type="radio" name="hl-where" checked={store.localOnly} disabled={ro} onChange={() => store.setLocalOnly(true)} className="mt-0.5" />
            <span>
              <b>This computer only</b>: kept in this browser and in {DB_FILE} in the highlights folder. Nothing goes to the cloud.
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="font-black text-slate-800 dark:text-slate-100">Local library</span>
          <span className="text-slate-500">{lib ? `“${lib.name}”${lib.ok ? '' : ' (needs a click to open again)'}` : 'no folder picked'}</span>
          <button
            type="button"
            disabled={!canWriteFolders()}
            onClick={async () => {
              const h = await pickLibrary();
              if (h) {
                setLib({ name: h.name, ok: true });
                await saveJson(false);
              }
            }}
            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1 disabled:opacity-40"
          >
            <FolderOpen size={12} /> {lib ? 'Pick another folder' : 'Pick the highlights folder'}
          </button>
          {lib && (
            <>
              <button type="button" onClick={() => void saveJson(true)} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1">
                <Save size={12} /> Save {DB_FILE} now
              </button>
              <button type="button" disabled={ro} onClick={() => void readJson()} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1">
                <Upload size={12} /> Read {DB_FILE}
              </button>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => {
                    setAuto(e.target.checked);
                    try {
                      localStorage.setItem(AUTO_JSON_KEY, e.target.checked ? '1' : '0');
                    } catch {
                      /* ignore */
                    }
                  }}
                />
                Keep {DB_FILE} up to date
              </label>
            </>
          )}
        </div>
        {!canWriteFolders() && <p className="text-[11px] text-slate-500">The local library needs Chrome or Edge on a computer.</p>}
        <p className="text-[11px] text-slate-500">
          The folder holds {DB_FILE} (every highlight, trim and reel), a Music folder for songs, and each exported reel ({season}\reel name: the timeline file, Graphics, Clips).
        </p>
        {note && <p role="status" className="text-xs font-semibold text-slate-700 dark:text-slate-200">{note}</p>}
      </section>
    </div>
  );
};
