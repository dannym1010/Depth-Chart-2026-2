import React, { useMemo, useState } from 'react';
import type { ScoutGame } from '../../hudlScout/components/Header';
import type { Play } from '../../hudlScout/types/football';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { DiagramImage } from '../playbook/DiagramImage';
import { playNameKey } from '../../utils/playbookImport';
import { resolveDiagram, unsavedDiagram } from '../../utils/playDiagrams';
import { drawCall } from '../../utils/callDiagram';
import {
  buildScoutScript,
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
  onDraw?: (play: ScoutOppPlay) => void;
}> = ({ games, libraries, filmPlays, opponent, selectedGameId, onSelectGame, onSave, deletedIds, onAddFilm, playDatabase, onDraw }) => {
  const films = games.length ? games : [];
  const gameId = films.some((g) => g.id === selectedGameId) ? selectedGameId : films[0]?.id || '';
  const plays = libraries[gameId] || [];
  const onTheReport = reportPlays(libraries);
  const script = buildScoutScript(onTheReport, opponent);
  const [draft, setDraft] = useState(emptyDraft);
  const [filmName, setFilmName] = useState('');
  const [printNote, setPrintNote] = useState('');

  // A play saved from the builder shows that drawing; one not saved yet is drawn from its name
  // ("30 DW 41 SWEEP"), the way the builder first draws it.
  const savedDiagram = (play: ScoutOppPlay) => {
    const entry = (playDatabase || []).find((p) => p.id === `scout_${play.id}`);
    return entry?.diagramUrl || unsavedDiagram(playNameKey(play.name));
  };
  const drawnFromName = useMemo(() => {
    const out = new Map<string, string | null>();
    for (const p of onTheReport) if (!savedDiagram(p)) out.set(p.id, drawCall(p));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTheReport.map((p) => `${p.id}:${p.name}:${p.formation}:${p.personnel}:${p.kind}`).join('|'), playDatabase]);
  const diagramFor = (play: ScoutOppPlay) => savedDiagram(play) || drawnFromName.get(play.id) || drawCall(play) || undefined;

  const printScript = async () => {
    setPrintNote('');
    const groups = ['1st', '2nd', '3rd', 'red', 'other'].map((id) => {
      const label = id === 'red' ? 'Red zone' : id === 'other' ? 'Other' : `${id} down`;
      const plays = onTheReport
        .filter((p) => (p.down || 'other') === id)
        .map((p) => ({
          name: p.name,
          detail: [p.formation, p.personnel, p.kind, p.notes].filter((s) => s && s !== '-').join(' · '),
          diagram: diagramFor(p),
        }));
      return { label, plays };
    });
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

  const write = (next: Record<string, ScoutOppPlay[]>, extraDeleted: string[] = []) => {
    const report = reportPlays(next);
    onSave(next, [...deletedIds, ...extraDeleted], buildScoutScript(report, opponent));
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
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Their plays, by film</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Each scouting video keeps the plays that team ran. Check a play to put it on this week's report.</p>
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
        {!gameId && <p className="text-sm text-slate-500">Add a film library, or upload this week's scouting film, then put their plays here.</p>}
        <ul className="space-y-1.5">
          {plays.map((p) => (
            <li key={p.id} className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5">
              <input type="checkbox" className="mt-1" checked={p.onReport} onChange={(e) => patch(p.id, { onReport: e.target.checked })} aria-label={`Put ${p.name} on the report`} />
              <button type="button" className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => onDraw?.(p)}>
                <span className="block text-sm font-black truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {[p.down === 'red' ? 'Red zone' : p.down, p.formation, p.personnel, p.kind].filter(Boolean).join(' · ')}
                  {p.notes ? ` · ${p.notes}` : ''}
                  {onDraw ? ' · Open in play builder' : ''}
                </span>
              </button>
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
          <p className="text-xs text-slate-500 mt-0.5">{onTheReport.length} play{onTheReport.length === 1 ? '' : 's'} on the report. Print includes the diagram for each play. This is separate from the practice plan.</p>
        </div>
        {script.periods.length === 0 ? (
          <p className="text-sm text-slate-500">Check plays to build the practice script.</p>
        ) : (
          <ol className="space-y-3">
            {script.lines.length > 0 &&
              ['1st down', '2nd down', '3rd down', 'Red zone', 'Other'].map((label) => {
                const rows = script.lines.filter((l) => l.period === label);
                if (!rows.length) return null;
                return (
                  <li key={label}>
                    <div className="text-[11px] font-black uppercase text-slate-500">{label}</div>
                    <div className="mt-1 space-y-2">
                      {rows.map((line) => {
                        const play = onTheReport.find((p) => p.id === line.playId);
                        const diagram = play ? diagramFor(play) : undefined;
                        return (
                          <div key={line.playId}>
                            <div className="text-sm font-black">{line.name}</div>
                            {line.detail && <div className="text-[11px] text-slate-500">{line.detail}</div>}
                            {diagram ? (
                              <>
                                <DiagramImage url={diagram} alt={line.name} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
                                {play && !savedDiagram(play) && (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    Drawn from the play name.{' '}
                                    {onDraw && (
                                      <button type="button" className="font-bold underline cursor-pointer" onClick={() => onDraw(play)}>
                                        Open to change it
                                      </button>
                                    )}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-400">No diagram yet. Open the play to draw it.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
          </ol>
        )}
        <button
          type="button"
          disabled={!script.periods.length}
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
