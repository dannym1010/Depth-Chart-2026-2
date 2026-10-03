import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Layers, Play as PlayIcon, Printer, Shield } from 'lucide-react';
import type { ScoutGame } from '../../hudlScout/components/Header';
import type { Play } from '../../hudlScout/types/football';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { DiagramImage } from '../playbook/DiagramImage';
import { openFilmWindow } from '../../filmroom/filmWindowStore';
import { playNameKey } from '../../utils/playbookImport';
import { resolveDiagram, unsavedDiagram } from '../../utils/playDiagrams';
import { drawCall } from '../../utils/callDiagram';
import { BACKFIELD_STRUCTURES } from '../../utils/footballEngine';
import { backfieldOf, leadOppPlay, redrawWithBackfield, type FilmBackfieldBases } from '../../utils/filmBackfields';
import {
  buildScoutScript,
  groupOppPlays,
  moveItem,
  snapsForCall,
  orderByIds,
  playsFromFilm,
  reportPlays,
  scoutScriptPrintHtml,
  type ScoutOppPlay,
  type ScoutPracticeScript,
} from '../../utils/scoutOppPlays';

const INPUT = 'h-9 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm';

const emptyDraft = (): Omit<ScoutOppPlay, 'id' | 'gameId' | 'editedAt' | 'onReport'> => ({
  name: '',
  formation: '',
  personnel: '',
  kind: 'run',
  down: '1st',
  notes: '',
});

export const ScoutOppPlayLibrary: React.FC<{
  games: ScoutGame[];
  libraries: Record<string, ScoutOppPlay[]>;
  filmPlays: Play[];
  opponent: string;
  selectedGameId: string;
  onSelectGame: (id: string) => void;
  onSave: (libraries: Record<string, ScoutOppPlay[]>, deletedIds: string[], script: ScoutPracticeScript) => void;
  deletedIds: string[];
  onAddFilm: (name: string) => void;
  playDatabase?: PlayDatabaseEntry[];
  onDraw?: (play: ScoutOppPlay, group?: { label: string; plays: ScoutOppPlay[] }) => void;
  /** This film's own backfield shapes. */
  backfieldBases?: FilmBackfieldBases;
  /** Open the builder to set that backfield for every play on this film that uses it. */
  onAdjustBackfield?: (gameId: string, backfield: string) => void;
  /** The practice order of the plays on the report. */
  scriptOrder?: string[];
}> = ({ games, libraries, filmPlays, opponent, selectedGameId, onSelectGame, onSave, deletedIds, onAddFilm, playDatabase, onDraw, backfieldBases, onAdjustBackfield, scriptOrder }) => {
  const films = games.length ? games : [];
  const gameId = films.some((g) => g.id === selectedGameId) ? selectedGameId : films[0]?.id || '';
  const plays = libraries[gameId] || [];
  const onTheReport = orderByIds(reportPlays(libraries), scriptOrder);
  const script = buildScoutScript(onTheReport, opponent);
  const [draft, setDraft] = useState(emptyDraft);
  const [filmName, setFilmName] = useState('');
  const [printNote, setPrintNote] = useState('');
  const [drag, setDrag] = useState<{ list: 'film' | 'script'; index: number } | null>(null);
  // Same play run either way (L / R, or another back to the other hole) shown as one play type.
  const [combine, setCombine] = useState(() => {
    try {
      return localStorage.getItem('scoutCombinePlays') === '1';
    } catch {
      return false;
    }
  });
  const toggleCombine = () => {
    setCombine((on) => {
      try {
        localStorage.setItem('scoutCombinePlays', on ? '0' : '1');
      } catch {
        // per-device preference only
      }
      return !on;
    });
  };
  const groups = useMemo(() => groupOppPlays(plays), [plays]);
  const film = useMemo(
    () => filmPlays.filter((p) => (p.gameId ? p.gameId === gameId : films[0]?.id === gameId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filmPlays, gameId]
  );
  const snapsOf = useMemo(() => {
    const map = new Map<string, ReturnType<typeof snapsForCall>>();
    for (const p of plays) map.set(p.id, snapsForCall(film, gameId, p.name, `scout_${p.id}`, p.fromPlayId));
    return map;
  }, [plays, film, gameId]);
  const snapCount = (p: ScoutOppPlay) => snapsOf.get(p.id)?.length || 0;
  // The film of these calls (a play, or every call in a play type), in play order, in the film window.
  const watchFilm = (members: ScoutOppPlay[], label: string) => {
    const byId = new Map<string, { id: string; playNumber: number }>();
    for (const m of members) for (const snap of snapsOf.get(m.id) || []) byId.set(snap.id, snap);
    const ids = [...byId.values()].sort((a, b) => a.playNumber - b.playNumber).map((x) => x.id);
    if (ids.length && gameId) openFilmWindow({ gameId, playIds: ids, label });
  };
  const drewDefense = (p: ScoutOppPlay) => (playDatabase || []).some((e) => e.id === `scout_${p.id}` && e.builder);

  // A play saved from the builder shows that drawing; one not saved yet is drawn from its name
  // ("30 DW 41 SWEEP"), the way the builder first draws it.
  const savedDiagram = (play: ScoutOppPlay) => {
    const entry = (playDatabase || []).find((p) => p.id === `scout_${play.id}`);
    return entry?.diagramUrl || unsavedDiagram(playNameKey(play.name));
  };
  const spotsFor = (play: ScoutOppPlay) => {
    const entry = (playDatabase || []).find((p) => p.id === `scout_${play.id}`);
    const base = backfieldBases?.[play.gameId]?.[backfieldOf(play, entry)];
    return { spots: base?.spots, baseKey: base?.baseKey };
  };
  const drawnFromName = useMemo(() => {
    const out = new Map<string, string | null>();
    for (const p of onTheReport) {
      if (savedDiagram(p)) continue;
      const spot = spotsFor(p);
      out.set(p.id, drawCall(p, spot.spots, spot.baseKey));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTheReport.map((p) => `${p.id}:${p.name}:${p.formation}:${p.personnel}:${p.kind}`).join('|'), playDatabase, backfieldBases]);
  const diagramFor = (play: ScoutOppPlay) => {
    const entry = (playDatabase || []).find((p) => p.id === `scout_${play.id}`);
    const backfield = backfieldOf(play, entry);
    const base = backfieldBases?.[play.gameId]?.[backfield];
    if (base?.spots) {
      const drawn = redrawWithBackfield(
        entry || { id: `scout_${play.id}`, name: play.name, diagramUrl: '' } as PlayDatabaseEntry,
        play,
        backfield,
        base.spots,
        base.baseKey
      );
      if (drawn.diagramUrl) return drawn.diagramUrl;
    }
    const spot = spotsFor(play);
    return savedDiagram(play) || drawnFromName.get(play.id) || drawCall(play, spot.spots, spot.baseKey) || undefined;
  };
  const filmBackfields = useMemo(() => {
    const keys = new Set<string>(['BEAST']);
    for (const p of plays) {
      const entry = (playDatabase || []).find((e) => e.id === `scout_${p.id}`);
      const key = backfieldOf(p, entry);
      if (BACKFIELD_STRUCTURES[key]) keys.add(key);
    }
    return [...keys].sort((a, b) => {
      if (a === 'BEAST') return -1;
      if (b === 'BEAST') return 1;
      return (BACKFIELD_STRUCTURES[a]?.hudlBackfield || a).localeCompare(BACKFIELD_STRUCTURES[b]?.hudlBackfield || b);
    });
  }, [plays, playDatabase]);

  const printScript = async () => {
    setPrintNote('');
    const groups = [
      {
        label: 'Scout script',
        plays: script.lines.map((line) => {
          const play = onTheReport.find((p) => p.id === line.playId);
          return { name: line.name, detail: line.detail, diagram: play ? diagramFor(play) : undefined };
        }),
      },
    ];
    const withPictures = await Promise.all(
      groups.map(async (g) => ({
        ...g,
        plays: await Promise.all(g.plays.map(async (p) => ({ ...p, diagram: await resolveDiagram(p.diagram) }))),
      }))
    );
    const html = scoutScriptPrintHtml(script.title, withPictures);
    const win = window.open('', '_blank');
    if (!win) {
      setPrintNote('Allow pop-ups to print the script.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const write = (next: Record<string, ScoutOppPlay[]>, extraDeleted: string[] = [], reportIds?: string[]) => {
    const report = orderByIds(reportPlays(next), reportIds || script.lines.map((l) => l.playId));
    onSave(next, [...deletedIds, ...extraDeleted], buildScoutScript(report, opponent));
  };

  const reorderFilm = (from: number, to: number) => {
    const next = moveItem(plays, from, to);
    if (next === plays) return;
    const now = Date.now();
    write({ ...libraries, [gameId]: next.map((p) => ({ ...p, reorderedAt: now })) });
  };

  const reorderScript = (from: number, to: number) => {
    const next = moveItem(onTheReport, from, to);
    if (next === onTheReport) return;
    onSave(libraries, deletedIds, buildScoutScript(next, opponent));
  };

  const addPlay = () => {
    const name = draft.name.trim();
    if (!gameId || !name) return;
    const play: ScoutOppPlay = {
      ...draft,
      name,
      id: `opp-${Date.now()}`,
      gameId,
      onReport: true,
      editedAt: Date.now(),
    };
    write({ ...libraries, [gameId]: [...plays, play] });
    setDraft(emptyDraft());
  };

  const patch = (id: string, partial: Partial<ScoutOppPlay>) => {
    write({
      ...libraries,
      [gameId]: plays.map((p) => (p.id === id ? { ...p, ...partial, editedAt: Date.now() } : p)),
    });
  };

  const setGroupOnReport = (members: ScoutOppPlay[], on: boolean) => {
    const ids = new Set(members.map((m) => m.id));
    const now = Date.now();
    write({ ...libraries, [gameId]: plays.map((p) => (ids.has(p.id) ? { ...p, onReport: on, editedAt: now } : p)) });
  };

  const printPlayTypes = async () => {
    setPrintNote('');
    const shown = groups.filter((g) => g.plays.some((p) => p.onReport));
    const list = shown.length ? shown : groups;
    const cards = await Promise.all(
      list.map(async (g) => {
        const lead = leadOppPlay(g.plays, playDatabase);
        const snaps = g.plays.reduce((n, p) => n + snapCount(p), 0);
        return {
          name: g.label,
          detail: [g.plays.map((p) => p.name).join(' · '), snaps ? `${snaps} snaps` : ''].filter(Boolean).join(' — '),
          diagram: await resolveDiagram(diagramFor(lead)),
        };
      })
    );
    const title = `${opponent.trim() || 'Opponent'}: their plays vs. our defense`;
    const win = window.open('', '_blank');
    if (!win) {
      setPrintNote('Allow pop-ups to print.');
      return;
    }
    win.document.write(scoutScriptPrintHtml(title, [{ label: 'Play types', plays: cards }]));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const remove = (id: string) => {
    write({ ...libraries, [gameId]: plays.filter((p) => p.id !== id) }, [id]);
  };

  const pullFilm = () => {
    if (!gameId) return;
    const film = filmPlays.filter((p) => (p.gameId ? p.gameId === gameId : films[0]?.id === gameId));
    const added = playsFromFilm(gameId, film, plays);
    if (!added.length) return;
    write({ ...libraries, [gameId]: [...plays, ...added] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-4">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Their plays, by film</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {combine
                ? 'Same play run either way is one play type: L or R, or another back to the other hole (37 Zone = 43 Zone). Draw how our defense lines up against each one.'
                : "Each scouting video keeps the plays that team ran. Drag a play to reorder it. Check it to put it on this week's report."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCombine}
            aria-pressed={combine}
            className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-1.5 cursor-pointer border shrink-0 ${
              combine
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
            }`}
          >
            <Layers className="w-4 h-4" /> {combine ? `Combined (${groups.length} types)` : 'Combine same plays'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {films.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGame(g.id)}
              className={`h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer ${gameId === g.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >
              {g.name}
              <span className="ml-1 opacity-70">{(libraries[g.id] || []).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${INPUT} max-w-[220px]`}
            placeholder="Film name"
            aria-label="New film name"
            value={filmName}
            onChange={(e) => setFilmName(e.target.value)}
          />
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold cursor-pointer"
            onClick={() => {
              const name = filmName.trim();
              if (!name) return;
              onAddFilm(name);
              setFilmName('');
            }}
          >
            New film library
          </button>
          {gameId && (
            <button type="button" className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold cursor-pointer" onClick={pullFilm}>
              Bring in plays from this film
            </button>
          )}
        </div>
        {gameId && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            <label className="sm:col-span-2 text-[11px] font-bold text-slate-500">
              Play
              <input className={`${INPUT} mt-1`} placeholder="36 Dive" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Formation
              <input className={`${INPUT} mt-1`} value={draft.formation} onChange={(e) => setDraft({ ...draft, formation: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Personnel
              <input className={`${INPUT} mt-1`} value={draft.personnel} onChange={(e) => setDraft({ ...draft, personnel: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-slate-500">
              Down
              <select className={`${INPUT} mt-1`} value={draft.down} onChange={(e) => setDraft({ ...draft, down: e.target.value })}>
                <option value="1st">1st</option>
                <option value="2nd">2nd</option>
                <option value="3rd">3rd</option>
                <option value="red">Red zone</option>
                <option value="other">Other</option>
              </select>
            </label>
            <button type="button" className="h-9 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer" onClick={addPlay}>
              Add play
            </button>
          </div>
        )}
        {gameId && onAdjustBackfield && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Base backfields for this film</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Adjusting one changes every play on this film that lines up in it.</p>
            <div className="flex flex-wrap gap-1.5">
              {filmBackfields.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-black cursor-pointer"
                  onClick={() => onAdjustBackfield(gameId, key)}
                >
                  Adjust {BACKFIELD_STRUCTURES[key]?.hudlBackfield || key}
                </button>
              ))}
            </div>
          </div>
        )}
        {!gameId && <p className="text-sm text-slate-500">Add a film library, or upload this week's scouting film, then put their plays here.</p>}
        {combine && gameId && (
          <div className="space-y-2">
            <ul className="space-y-2">
              {groups.map((g) => {
                const lead = leadOppPlay(g.plays, playDatabase);
                const picture = diagramFor(lead);
                const drawn = drewDefense(lead);
                const snaps = g.plays.reduce((n, p) => n + snapCount(p), 0);
                const allOn = g.plays.every((p) => p.onReport);
                const someOn = g.plays.some((p) => p.onReport);
                return (
                  <li key={g.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      className="sm:w-48 shrink-0 cursor-pointer disabled:cursor-default"
                      disabled={!onDraw}
                      onClick={() => onDraw?.(lead, g)}
                      aria-label={`Open ${g.label}`}
                    >
                      {picture ? (
                        <DiagramImage url={picture} alt={g.label} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
                      ) : (
                        <div className="h-24 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[11px] text-slate-400 flex items-center justify-center">No picture yet</div>
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={allOn}
                          ref={(el) => {
                            if (el) el.indeterminate = someOn && !allOn;
                          }}
                          onChange={(e) => setGroupOnReport(g.plays, e.target.checked)}
                          aria-label={`Put ${g.label} on the report`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 dark:text-white">{g.label}</div>
                          <div className="text-[11px] text-slate-500">
                            {g.plays.length} call{g.plays.length === 1 ? '' : 's'}
                            {snaps ? ` · ran it ${snaps} time${snaps === 1 ? '' : 's'}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {g.plays.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onDraw?.(p)}
                            title="Open this call in the play builder"
                            className={`h-7 px-2 rounded-md text-[11px] font-bold border cursor-pointer ${
                              p.id === lead.id
                                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                      {onDraw && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDraw(lead, g)}
                            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" /> {drawn ? 'Edit our defense' : 'Draw our defense'}
                          </button>
                          {snaps > 0 && (
                            <button
                              type="button"
                              onClick={() => watchFilm(g.plays, g.label)}
                              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-700 dark:text-slate-200 hover:border-indigo-400 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <PlayIcon className="w-3.5 h-3.5" /> Watch film ({snaps})
                            </button>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {drawn ? `Drawn on ${lead.name}` : 'Drag our players into place, then Save'}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!groups.length}
                onClick={() => void printPlayTypes()}
                className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Printer className="w-4 h-4" /> Print play types vs. our defense
              </button>
              <span className="text-[11px] text-slate-400">The checked ones also print on the scouting report (Game plan → Print sideline call sheet).</span>
            </div>
            {printNote && <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{printNote}</p>}
          </div>
        )}
        <ul className={combine ? 'hidden' : 'space-y-1.5'}>
          {plays.map((p, index) => (
            <li
              key={p.id}
              className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 ${drag?.list === 'film' && drag.index === index ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'}`}
              onDragOver={(e) => {
                if (drag?.list === 'film') e.preventDefault();
              }}
              onDrop={() => {
                if (drag?.list === 'film') reorderFilm(drag.index, index);
                setDrag(null);
              }}
            >
              <button
                type="button"
                draggable
                aria-label={`Drag ${p.name}`}
                onDragStart={() => setDrag({ list: 'film', index })}
                onDragEnd={() => setDrag(null)}
                className="mt-1 cursor-grab text-slate-400 active:cursor-grabbing"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${p.name} up`} disabled={index === 0} onClick={() => reorderFilm(index, index - 1)} className="text-slate-400 disabled:opacity-20 cursor-pointer">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={`Move ${p.name} down`} disabled={index === plays.length - 1} onClick={() => reorderFilm(index, index + 1)} className="text-slate-400 disabled:opacity-20 cursor-pointer">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <input type="checkbox" className="mt-1" checked={p.onReport} onChange={(e) => patch(p.id, { onReport: e.target.checked })} aria-label={`Put ${p.name} on the report`} />
              <button type="button" className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => onDraw?.(p)}>
                <span className="block text-sm font-black truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {[p.down === 'red' ? 'Red zone' : p.down, p.formation, p.personnel, p.kind].filter(Boolean).join(' · ')}
                  {p.notes ? ` · ${p.notes}` : ''}
                  {onDraw ? ' · Open in play builder' : ''}
                </span>
              </button>
              {snapCount(p) > 0 && (
                <button
                  type="button"
                  title={`Watch ${snapCount(p)} snap${snapCount(p) === 1 ? '' : 's'} of ${p.name}`}
                  onClick={() => watchFilm([p], p.name)}
                  className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:border-indigo-400 inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <PlayIcon className="w-3 h-3" /> {snapCount(p)}
                </button>
              )}
              <button
                type="button"
                className="text-[11px] font-bold text-slate-400 cursor-pointer"
                onClick={() => {
                  if (window.confirm(`Remove ${p.name} from this film's plays?`)) remove(p.id);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3 lg:sticky lg:top-3 h-fit">
        <div>
          <h2 className="text-sm font-black">{script.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{onTheReport.length} play{onTheReport.length === 1 ? '' : 's'} on the report. Drag to set the practice order. Print follows this order. This is separate from the practice plan.</p>
        </div>
        {script.lines.length === 0 ? (
          <p className="text-sm text-slate-500">Check plays to build the practice script.</p>
        ) : (
          <ol className="space-y-2">
            {script.lines.map((line, index) => {
              const play = onTheReport.find((p) => p.id === line.playId);
              const diagram = play ? diagramFor(play) : undefined;
              return (
                <li
                  key={line.playId}
                  className={`rounded-lg border p-2 ${drag?.list === 'script' && drag.index === index ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'}`}
                  onDragOver={(e) => {
                    if (drag?.list === 'script') e.preventDefault();
                  }}
                  onDrop={() => {
                    if (drag?.list === 'script') reorderScript(drag.index, index);
                    setDrag(null);
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag ${line.name}`}
                      onDragStart={() => setDrag({ list: 'script', index })}
                      onDragEnd={() => setDrag(null)}
                      className="mt-0.5 cursor-grab text-slate-400 active:cursor-grabbing"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-col">
                      <button type="button" aria-label={`Move ${line.name} up in the script`} disabled={index === 0} onClick={() => reorderScript(index, index - 1)} className="text-slate-400 disabled:opacity-20 cursor-pointer">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label={`Move ${line.name} down in the script`} disabled={index === script.lines.length - 1} onClick={() => reorderScript(index, index + 1)} className="text-slate-400 disabled:opacity-20 cursor-pointer">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default"
                      disabled={!play || !onDraw}
                      onClick={() => play && onDraw?.(play)}
                    >
                      <div className="text-sm font-black">{index + 1}. {line.name}</div>
                      {line.detail && <div className="text-[11px] text-slate-500">{line.detail}</div>}
                      {onDraw && play && <div className="text-[11px] text-slate-500">Open in play builder</div>}
                    </button>
                  </div>
                  {diagram ? (
                    <>
                      <button
                        type="button"
                        className="mt-1 block w-full cursor-pointer disabled:cursor-default"
                        disabled={!play || !onDraw}
                        aria-label={`Open ${line.name}`}
                        onClick={() => play && onDraw?.(play)}
                      >
                        <DiagramImage url={diagram} alt={line.name} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
                      </button>
                      {play && !savedDiagram(play) && (
                        <p className="mt-0.5 text-[10px] text-slate-400">Drawn from the play name.</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">No diagram yet. Open the play to draw it.</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <button
          type="button"
          disabled={!script.lines.length}
          className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black cursor-pointer disabled:opacity-40"
          onClick={() => void printScript()}
        >
          Print script
        </button>
        {printNote && <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{printNote}</p>}
      </section>
    </div>
  );
};
