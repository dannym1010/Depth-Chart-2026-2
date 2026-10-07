import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, GripVertical, Image as ImageIcon, Layers, Pencil, Play as PlayIcon, Plus, Printer, Shield, X } from 'lucide-react';
import type { ScoutGame } from '../../hudlScout/components/Header';
import type { Play } from '../../hudlScout/types/football';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { DiagramImage } from '../playbook/DiagramImage';
import { openFilmWindow } from '../../filmroom/filmWindowStore';
import { inferPlayType, playNameKey } from '../../utils/playbookImport';
import { resolveDiagram, unsavedDiagram } from '../../utils/playDiagrams';
import { drawCall } from '../../utils/callDiagram';
import { BACKFIELD_STRUCTURES } from '../../utils/footballEngine';
import { backfieldOf, formationDefense, formationOfPlay, leadOppPlay, playWithDefense, redrawWithBackfield, type FilmBackfieldBases } from '../../utils/filmBackfields';
import {
  buildScoutScript,
  groupOppPlays,
  moveItem,
  parseClips,
  realCall,
  isScoutPlayEntry,
  PLAN_SITUATIONS,
  type FormationPlan,
  type OppFormation,
  snapsForCall,
  orderByIds,
  playsFromFilm,
  reportPlays,
  scoutScriptPrintHtml,
  type ScoutOppPlay,
  type ScoutPracticeScript,
  orderScript,
  SCRIPT_ORDERS,
  type ScriptOrder,
  KIND_LOOK,
  scriptByFormation,
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
  /** Their formations (drawn once; their plays start from them). */
  formations?: OppFormation[];
  onEditFormation?: (req: { id?: string; name: string; gameId?: string; clip?: number }) => void;
  onSaveFormations?: (list: OppFormation[]) => void;
  /** The calls against their formations changed (they go on the call sheets). */
  onPlansChange?: (list: OppFormation[]) => void;
}> = ({ games, libraries, filmPlays, opponent, selectedGameId, onSelectGame, onSave, deletedIds, onAddFilm, playDatabase, onDraw, backfieldBases, onAdjustBackfield, scriptOrder, formations, onEditFormation, onSaveFormations, onPlansChange }) => {
  const films = games.length ? games : [];
  const gameId = films.some((g) => g.id === selectedGameId) ? selectedGameId : films[0]?.id || '';
  const plays = libraries[gameId] || [];
  const onTheReport = orderByIds(reportPlays(libraries), scriptOrder);
  const script = buildScoutScript(onTheReport, opponent);
  const [draft, setDraft] = useState(emptyDraft);
  const shownFormations = (formations || []).filter((f) => f?.id && !f.deleted);
  const [formName, setFormName] = useState('');
  // The formation cards show the base, or our defense lined up against it (per device).
  const [formView, setFormView] = useState<'base' | 'defense'>(() => {
    try {
      return localStorage.getItem('scoutFormationView') === 'defense' ? 'defense' : 'base';
    } catch {
      return 'base';
    }
  });
  const pickFormView = (v: 'base' | 'defense') => {
    setFormView(v);
    try {
      localStorage.setItem('scoutFormationView', v);
    } catch {
      /* per device only */
    }
  };
  const [formClip, setFormClip] = useState('');
  const [fromFormation, setFromFormation] = useState('');
  const [clipText, setClipText] = useState('');
  const clipInput = React.useRef<HTMLInputElement>(null);
  const [filmName, setFilmName] = useState('');
  const [printNote, setPrintNote] = useState('');
  const [drag, setDrag] = useState<{ list: 'film' | 'script'; index: number } | null>(null);
  // The script: short rows to arrange fast, or with each play's picture (remembered on this device).
  const [scriptPics, setScriptPics] = useState(() => {
    try {
      return localStorage.getItem('scoutScriptPictures') === '1';
    } catch {
      return false;
    }
  });
  const toggleScriptPics = () =>
    setScriptPics((on) => {
      try {
        localStorage.setItem('scoutScriptPictures', on ? '0' : '1');
      } catch {
        // per-device preference only
      }
      return !on;
    });
  // Dragging a script row (mouse or finger): the order as it would land, shown while dragging.
  const [scriptDrag, setScriptDrag] = useState<{ id: string; order: string[] } | null>(null);
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
    for (const p of plays) map.set(p.id, snapsForCall(film, gameId, p.name, `scout_${p.id}`, p.fromPlayId, p.clips));
    return map;
  }, [plays, film, gameId]);
  const snapCount = (p: ScoutOppPlay) => snapsOf.get(p.id)?.length || 0;
  /** The play each snap on this film is (the first that claims it). */
  const cardOfSnap = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of plays) for (const snap of snapsOf.get(p.id) || []) if (!out.has(snap.id)) out.set(snap.id, p.id);
    return out;
  }, [plays, snapsOf]);
  /** Every play of theirs in the same play type (across films), for a script play with no film of its own. */
  const allTypes = useMemo(() => groupOppPlays(Object.values(libraries).flat()), [libraries]);
  /**
   * The film for a play on the script (any film, not just the one picked above): its own snaps, else every
   * snap of its play type. Clicking it opens the builder with the same film, so Watch film is there too.
   */
  const scriptFilm = (p: ScoutOppPlay) => {
    const filmOf = (gid: string) => filmPlays.filter((fp) => (fp.gameId ? fp.gameId === gid : films[0]?.id === gid));
    const own = snapsForCall(filmOf(p.gameId), p.gameId, p.name, `scout_${p.id}`, p.fromPlayId, p.clips);
    if (own.length) return { snaps: own, group: undefined };
    const g = allTypes.find((t) => t.plays.some((x) => x.id === p.id));
    if (!g || g.plays.length < 2) return { snaps: own, group: undefined };
    const byId = new Map<string, { id: string; playNumber: number }>();
    for (const m of g.plays) for (const snap of snapsForCall(filmOf(m.gameId), m.gameId, m.name, `scout_${m.id}`, m.fromPlayId, m.clips)) byId.set(snap.id, snap);
    return { snaps: [...byId.values()].sort((a, b) => a.playNumber - b.playNumber), group: { label: g.label, plays: g.plays } };
  };
  /** Run, pass, screen or RPO: a play left at the default (run) goes by what its name says ("BUBBLE PASS" is a pass). */
  const kindOf = (p: ScoutOppPlay): ScoutOppPlay['kind'] => {
    if (p.kind !== 'run') return p.kind;
    const t = (playDatabase || []).find((e) => e.id === `scout_${p.id}`)?.type || inferPlayType(p.name, 'offense');
    return t === 'pass' || t === 'play_action' ? 'pass' : t === 'screen' ? 'screen' : t === 'rpo' ? 'rpo' : 'run';
  };
  const openScriptPlay = (p: ScoutOppPlay) => {
    const { snaps, group } = scriptFilm(p);
    onDraw?.(p, snaps.length && group ? group : undefined);
  };
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
    // Against the defense set on their formation (the play's own lines kept).
    const d = formationDefense(formationOfPlay(play, formations), playDatabase || []);
    if (d) {
      const drawn = playWithDefense(entry || ({ id: `scout_${play.id}`, name: play.name, diagramUrl: '' } as PlayDatabaseEntry), play, d, backfieldBases);
      if (drawn.diagramUrl) return drawn.diagramUrl;
    }
    // Drawn in the builder: exactly what was saved there (a film backfield change already saved it again).
    if (entry?.builder && entry.diagramUrl) return entry.diagramUrl;
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
    // Each formation on its own page, the plays in script order, run / pass marked.
    const lines = script.lines.map((line) => {
      const play = onTheReport.find((p) => p.id === line.playId);
      // How many times they ran it (its clips on the film).
      const ran = play ? scriptFilm(play).snaps.length : 0;
      const detail = [line.detail, ran ? `Ran it ${ran} time${ran === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
      // Its formation as tagged, else the one of theirs it was drawn from.
      const tagged = play?.formation && play.formation.trim() !== '-' ? play.formation : '';
      const formation = tagged || (play ? formationOfPlay(play, formations)?.name : '') || '';
      return { name: line.name, detail, diagram: play ? diagramFor(play) : undefined, kind: play ? kindOf(play) : undefined, formation };
    });
    const groups = scriptByFormation(lines);
    const withPictures = await Promise.all(
      groups.map(async (g) => ({
        ...g,
        plays: await Promise.all(g.plays.map(async (p) => ({ ...p, diagram: await resolveDiagram(p.diagram) }))),
      }))
    );
    const html = scoutScriptPrintHtml(script.title, withPictures, { pagePerGroup: true });
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
  /** The script in this order (play ids). */
  const setScriptOrder = (ids: string[]) => {
    const next = orderByIds(onTheReport, ids);
    if (next.every((p, i) => p.id === onTheReport[i]?.id)) return;
    onSave(libraries, deletedIds, buildScoutScript(next, opponent));
  };
  /** Move a play straight to a spot (0 = first). */
  const moveScriptTo = (id: string, to: number) => {
    const from = onTheReport.findIndex((p) => p.id === id);
    if (from < 0) return;
    reorderScript(from, Math.max(0, Math.min(onTheReport.length - 1, to)));
  };
  const orderScriptBy = (by: ScriptOrder) => {
    const filmOrder = [...games.flatMap((g) => libraries[g.id] || []), ...Object.values(libraries).flat()];
    const typed = onTheReport.map((p) => (kindOf(p) === p.kind ? p : { ...p, kind: kindOf(p) }));
    setScriptOrder(orderScript(typed, by, filmOrder).map((p) => p.id));
  };

  const addPlay = () => {
    const f = shownFormations.find((x) => x.id === fromFormation);
    const clips = parseClips(clipText);
    const name = draft.name.trim() || (f ? `${f.name}${clips.length ? ` #${clips[0]}` : ''}` : '');
    if (!gameId || !name) return;
    const play: ScoutOppPlay = {
      ...draft,
      name,
      formation: f ? f.name : draft.formation,
      personnel: f?.builder?.personnel != null ? String(f.builder.personnel) : draft.personnel,
      id: `opp-${Date.now()}`,
      gameId,
      onReport: true,
      editedAt: Date.now(),
      ...(clips.length ? { clips } : {}),
      ...(f ? { formationId: f.id } : {}),
    };
    setDraft(emptyDraft());
    setClipText('');
    // Straight into the builder, lined up in their formation, with the clip playing beside it.
    if (onDraw) onDraw(play);
    else write({ ...libraries, [gameId]: [...plays, play] });
  };
  const addClip = (p: ScoutOppPlay) => {
    const typed = window.prompt(`Clip number(s) on this film where they ran ${p.name}:`, '');
    const clips = parseClips(typed || '');
    if (!clips.length) return;
    patch(p.id, { clips: [...new Set([...(p.clips || []), ...clips])].sort((a, b) => a - b) });
  };
  const formKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const taggedFormations = useMemo(() => {
    const byKey = new Map<string, { name: string; clips: { n: number; call: string; cardId?: string }[] }>();
    for (const p of film) {
      if (p.odk && p.odk !== 'O' && p.odk !== 'UNKNOWN') continue;
      const name = String(p.formation || '').trim();
      if (!name || name === '-') continue;
      const key = formKey(name);
      if (!byKey.has(key)) byKey.set(key, { name, clips: [] });
      const call = String(p.playCall || '').trim() || realCall(p);
      byKey.get(key)!.clips.push({
        n: Number(p.playNumber) || 0,
        call: call === '-' ? '' : call,
        // Its play: tagged with it directly, else matched the way the script matches (call, clip typed in, tag).
        cardId: p.playCallId?.startsWith('scout_') ? p.playCallId.slice(6) : cardOfSnap.get(p.id),
      });
    }
    for (const v of byKey.values()) v.clips.sort((a, b) => a.n - b.n);
    return byKey;
  }, [film, cardOfSnap]);
  // Every formation: the ones drawn or named here, then the ones tagged on the film that aren't yet (not drawn).
  const formationCards = useMemo(() => {
    const removed = new Set((formations || []).filter((x) => x?.deleted).map((x) => formKey(x.name || '')));
    const saved = shownFormations.map((x) => ({ f: x, clips: taggedFormations.get(formKey(x.name))?.clips || [] }));
    const have = new Set(shownFormations.map((x) => formKey(x.name)));
    const fromFilm = [...taggedFormations.entries()]
      .filter(([key]) => !have.has(key) && !removed.has(key))
      .sort((a, b) => b[1].clips.length - a[1].clips.length)
      .map(([, v]) => ({ f: { id: '', name: v.name, editedAt: 0 } as OppFormation, clips: v.clips }));
    return [...saved, ...fromFilm];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownFormations, taggedFormations, formations]);
  const drawFormation = (x: OppFormation, clips: { n: number }[]) =>
    onEditFormation?.({ id: x.id || undefined, name: x.name, gameId: x.gameId || gameId, clip: x.clip || clips[0]?.n });
  /** A clip of this formation: open its play (tagged before), or start one from the formation with the clip playing. */
  const playFromClip = (x: OppFormation, clip: { n: number; call: string; cardId?: string }) => {
    const existing = clip.cardId ? plays.find((c) => c.id === clip.cardId) : undefined;
    if (existing) return onDraw?.(existing);
    const play: ScoutOppPlay = {
      ...emptyDraft(),
      name: clip.call || `${x.name} #${clip.n}`,
      formation: x.name,
      personnel: x.builder?.personnel != null ? String(x.builder.personnel) : '',
      id: `opp-${Date.now()}`,
      gameId,
      onReport: true,
      editedAt: Date.now(),
      clips: [clip.n],
      ...(x.builder ? { formationId: x.id } : {}),
    };
    if (onDraw) onDraw(play);
    else write({ ...libraries, [gameId]: [...plays, play] });
  };
  // Our calls against each formation: our defensive plays from the Play Library.
  const defenseCalls = useMemo(
    () =>
      (playDatabase || [])
        .filter((p) => p.unit === 'defense' && !isScoutPlayEntry(p))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [playDatabase]
  );
  const callName = (id?: string) => (id ? defenseCalls.find((p) => p.id === id)?.name : undefined);
  const [planDraft, setPlanDraft] = useState<Record<string, { situation: string; callId: string }>>({});
  const savePlan = (f: OppFormation, plan: FormationPlan) => {
    if (!onSaveFormations) return;
    const now = Date.now();
    const list = formations || [];
    const old = f.id ? list.find((x) => x.id === f.id) : undefined;
    // A formation only tagged on the film gets its record now.
    const rec: OppFormation = { ...(old || { id: `form-${now}`, name: f.name, gameId, editedAt: now }), plan, editedAt: now };
    const next = old ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec];
    onSaveFormations(next);
    onPlansChange?.(next);
  };
  const removeFormation = (f: OppFormation) => {
    if (!onSaveFormations || !window.confirm(`Remove the formation ${f.name}? Plays already drawn from it stay.`)) return;
    const now = Date.now();
    onSaveFormations((formations || []).map((x) => (x.id === f.id ? { ...x, deleted: true, editedAt: now } : x)));
    if (fromFormation === f.id) setFromFormation('');
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
        {gameId && onEditFormation && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">1 · Their formations</div>
                <div role="group" aria-label="Show on the formations" className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-[11px] font-black">
                  {(['base', 'defense'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={formView === v}
                      onClick={() => pickFormView(v)}
                      className={`h-7 px-2.5 cursor-pointer ${formView === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {v === 'base' ? 'Their formation' : 'Our defense vs it'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formations tagged on this film show up here with their clips. Draw each base once (a clip of it plays while you line them up), then click a clip to make that play from it. Green clips already have a play.
              </p>
            </div>
            {formationCards.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {formationCards.map(({ f, clips }) => {
                  const drawn = Boolean(f.builder);
                  const open = clips.filter((c) => !c.cardId).length;
                  return (
                    <li key={f.id || `film:${f.name}`} className={`rounded-lg border p-1.5 space-y-1 ${fromFormation && fromFormation === f.id ? 'border-indigo-400 ring-1 ring-indigo-300' : drawn ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-300 dark:border-slate-600'}`}>
                      <button type="button" className="block w-full cursor-pointer" onClick={() => drawFormation(f, clips)} aria-label={`Draw ${f.name}`}>
                        {formView === 'defense' && f.diagramUrl && !f.defenseUrl ? (
                          <div className="h-16 rounded-md border border-dashed border-emerald-400/70 text-[11px] text-slate-400 flex flex-col items-center justify-center">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">Draw our defense</span>
                            vs {f.name}
                          </div>
                        ) : formView === 'defense' && f.defenseUrl ? (
                          <DiagramImage url={f.defenseUrl} alt={`${f.name} vs ${f.defenseName || 'our defense'}`} className="w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-white" />
                        ) : f.diagramUrl ? (
                          <DiagramImage url={f.diagramUrl} alt={f.name} className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white" />
                        ) : (
                          <div className="h-16 rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-[11px] text-slate-400 flex flex-col items-center justify-center">
                            <span className="font-bold text-indigo-600 dark:text-indigo-300">Draw the base</span>
                            {f.id ? 'Not drawn yet' : 'Tagged on the film'}
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-900 dark:text-white" title={f.name}>
                          {f.name}
                          {formView === 'defense' && f.defenseName ? <span className="font-bold text-emerald-700 dark:text-emerald-400"> vs {f.defenseName}</span> : null}
                        </span>
                        {clips.length > 0 && (
                          <span className="text-[10px] text-slate-400 shrink-0" title={`${clips.length} clips tagged in this formation, ${open} without a play yet`}>
                            {clips.length} clip{clips.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {clips.length > 0 && (
                        <div className="flex flex-wrap gap-0.5" aria-label={`Clips in ${f.name}`}>
                          {clips.map((c) => (
                            <button
                              key={c.n}
                              type="button"
                              onClick={() => playFromClip(f, c)}
                              title={c.cardId ? `Clip ${c.n}: ${c.call || 'play'} (open it)` : `Clip ${c.n}${c.call ? ` (${c.call})` : ''}: make their play from ${f.name}${drawn ? '' : ' (draw the base first to start lined up)'}`}
                              className={`h-6 min-w-[1.75rem] px-1 rounded text-[10px] font-black tabular-nums cursor-pointer ${
                                c.cardId
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              {c.n}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFromFormation(f.id);
                            window.setTimeout(() => clipInput.current?.focus(), 0);
                          }}
                          disabled={!drawn}
                          title={drawn ? 'Make a play that starts from this formation' : 'Draw the formation first'}
                          className="flex-1 h-7 rounded-md bg-indigo-600 text-white text-[11px] font-black inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" /> Play
                        </button>
                        <button
                          type="button"
                          onClick={() => drawFormation(f, clips)}
                          title={drawn ? 'Adjust this base formation' : 'Draw this base formation'}
                          className="h-7 w-7 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {onSaveFormations && f.id && (
                          <button
                            type="button"
                            onClick={() => removeFormation(f)}
                            title="Remove this formation"
                            className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-500 inline-flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-bold text-slate-500 flex-1 min-w-[160px]">
                New formation
                <input
                  className={`${INPUT} mt-1`}
                  placeholder="Trips Rt, 21 Beast R…"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formName.trim()) {
                      onEditFormation({ name: formName, gameId, clip: parseClips(formClip)[0] });
                      setFormName('');
                      setFormClip('');
                    }
                  }}
                />
              </label>
              <label className="text-[11px] font-bold text-slate-500 w-20">
                Clip #
                <input className={`${INPUT} mt-1`} inputMode="numeric" placeholder="12" value={formClip} onChange={(e) => setFormClip(e.target.value)} />
              </label>
              <button
                type="button"
                disabled={!formName.trim()}
                onClick={() => {
                  onEditFormation({ name: formName, gameId, clip: parseClips(formClip)[0] });
                  setFormName('');
                  setFormClip('');
                }}
                className="h-9 px-3 rounded-lg border border-indigo-500 text-indigo-700 dark:text-indigo-300 text-xs font-black cursor-pointer disabled:opacity-40"
              >
                Draw formation
              </button>
            </div>
          </div>
        )}
        {gameId && onSaveFormations && formationCards.length > 0 && (
          <div className="rounded-xl border border-emerald-300/70 dark:border-emerald-800 p-3 space-y-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Our calls vs their formations</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick the base call and the calls you make in certain situations against each formation (your defensive plays from the Play Library).
                They go on the defense side of the call sheet and on the sideline sheet.
                {defenseCalls.length === 0 ? ' No defensive plays in the Play Library yet.' : ''}
              </p>
            </div>
            <ul className="space-y-2">
              {formationCards.map(({ f }) => {
                const plan: FormationPlan = f.plan || { calls: [] };
                const key = f.id || `film:${f.name}`;
                const draft = planDraft[key] || { situation: '', callId: '' };
                const setDraft = (d: Partial<typeof draft>) => setPlanDraft((all) => ({ ...all, [key]: { ...draft, ...d } }));
                return (
                  <li key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white min-w-[7rem]">vs {f.name}</span>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        Base
                        <select
                          aria-label={`Base call vs ${f.name}`}
                          value={plan.base || ''}
                          onChange={(e) => savePlan(f, { ...plan, base: e.target.value || undefined })}
                          className={`${INPUT} !h-8 !w-auto min-w-[12rem] text-xs font-bold`}
                        >
                          <option value="">Pick the base call</option>
                          {defenseCalls.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {plan.calls.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {plan.calls.map((c) => (
                          <li key={c.id} className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                            <b className="text-emerald-800 dark:text-emerald-300">{c.situation}:</b>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{callName(c.callId) || 'Call removed from the Play Library'}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${c.situation}`}
                              onClick={() => savePlan(f, { ...plan, calls: plan.calls.filter((x) => x.id !== c.id) })}
                              className="h-5 w-5 rounded text-slate-400 hover:text-rose-500 inline-flex items-center justify-center cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        list="plan-situations"
                        aria-label={`Situation vs ${f.name}`}
                        placeholder="Situation (3rd & long…)"
                        value={draft.situation}
                        onChange={(e) => setDraft({ situation: e.target.value })}
                        className={`${INPUT} !h-8 !w-40 text-xs`}
                      />
                      <select
                        aria-label={`Call for the situation vs ${f.name}`}
                        value={draft.callId}
                        onChange={(e) => setDraft({ callId: e.target.value })}
                        className={`${INPUT} !h-8 !w-auto min-w-[12rem] text-xs`}
                      >
                        <option value="">Pick the call (blitz…)</option>
                        {defenseCalls.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.type === 'blitz' ? ' (blitz)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!draft.situation.trim() || !draft.callId}
                        onClick={() => {
                          savePlan(f, { ...plan, calls: [...plan.calls, { id: `c${Date.now().toString(36)}`, situation: draft.situation.trim(), callId: draft.callId }] });
                          setPlanDraft((all) => ({ ...all, [key]: { situation: '', callId: '' } }));
                        }}
                        className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-40"
                      >
                        Add call
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <datalist id="plan-situations">
              {PLAN_SITUATIONS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        )}
        {gameId && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            {onEditFormation && <div className="col-span-2 sm:col-span-6 -mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">2 · Their plays</div>}
            {shownFormations.length > 0 ? (
              <label className="sm:col-span-2 text-[11px] font-bold text-slate-500">
                From formation
                <select className={`${INPUT} mt-1`} value={fromFormation} onChange={(e) => setFromFormation(e.target.value)}>
                  <option value="">None (draw from the name)</option>
                  {shownFormations.filter((f) => f.builder).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="sm:col-span-2 text-[11px] font-bold text-slate-500">
                Formation
                <input className={`${INPUT} mt-1`} value={draft.formation} onChange={(e) => setDraft({ ...draft, formation: e.target.value })} />
              </label>
            )}
            <label className="text-[11px] font-bold text-slate-500">
              Clip #
              <input
                ref={clipInput}
                className={`${INPUT} mt-1`}
                inputMode="numeric"
                placeholder="12"
                title="The clip on this film where they ran it (several: 12, 15)"
                value={clipText}
                onChange={(e) => setClipText(e.target.value)}
              />
            </label>
            <label className="sm:col-span-2 text-[11px] font-bold text-slate-500">
              Play
              <input
                className={`${INPUT} mt-1`}
                placeholder={fromFormation ? 'Name (optional), e.g. 36 Dive' : '36 Dive'}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addPlay();
                }}
              />
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
            <button
              type="button"
              className="h-9 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer disabled:opacity-40"
              disabled={!draft.name.trim() && !fromFormation}
              onClick={addPlay}
            >
              {onDraw ? 'Draw play' : 'Add play'}
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
              {p.clips?.length ? (
                <span className="text-[11px] font-bold text-slate-500 shrink-0 mt-1" title="Clips tagged with this play">
                  Clip {p.clips.join(', ')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => addClip(p)}
                title="Tag a clip number with this play"
                className="h-7 px-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-500 hover:border-indigo-400 shrink-0 cursor-pointer"
              >
                + clip
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
          <p className="text-xs text-slate-500 mt-0.5">{onTheReport.length} play{onTheReport.length === 1 ? '' : 's'} on the report. Drag the handle, type a number, or put them in order at once. Print follows this order.</p>
        </div>
        {script.lines.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Put the script in order"
              value=""
              onChange={(e) => e.target.value && orderScriptBy(e.target.value as ScriptOrder)}
              className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs font-bold"
            >
              <option value="">Order by…</option>
              {SCRIPT_ORDERS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={scriptPics}
              onClick={toggleScriptPics}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${scriptPics ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Pictures
            </button>
          </div>
        )}
        {script.lines.length === 0 ? (
          <p className="text-sm text-slate-500">Check plays to build the practice script.</p>
        ) : (
          <ol className="space-y-1.5">
            {(scriptDrag ? scriptDrag.order.map((id) => script.lines.find((l) => l.playId === id)!).filter(Boolean) : script.lines).map((line, index, shown) => {
              const play = onTheReport.find((p) => p.id === line.playId);
              const diagram = scriptPics && play ? diagramFor(play) : undefined;
              const dragging = scriptDrag?.id === line.playId;
              const look = play ? KIND_LOOK[kindOf(play)] : undefined;
              return (
                <li
                  key={line.playId}
                  data-script-id={line.playId}
                  style={look ? { borderLeft: `5px solid ${look.color}` } : undefined}
                  className={`rounded-lg border ${scriptPics ? 'p-2' : 'px-1.5 py-1'} ${dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Drag ${line.name}`}
                      title="Drag to move"
                      className="touch-none cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setScriptDrag({ id: line.playId, order: script.lines.map((l) => l.playId) });
                      }}
                      onPointerMove={(e) => {
                        if (!scriptDrag) return;
                        // Near the top or bottom of the window: scroll, so a long script can be crossed.
                        if (e.clientY < 70) window.scrollBy(0, -14);
                        else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
                        const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-script-id]') as HTMLElement | null;
                        const overId = over?.dataset.scriptId;
                        if (!overId || overId === scriptDrag.id) return;
                        const to = scriptDrag.order.indexOf(overId);
                        const rest = scriptDrag.order.filter((x) => x !== scriptDrag.id);
                        rest.splice(to, 0, scriptDrag.id);
                        setScriptDrag({ ...scriptDrag, order: rest });
                      }}
                      onPointerUp={() => {
                        if (scriptDrag) setScriptOrder(scriptDrag.order);
                        setScriptDrag(null);
                      }}
                      onPointerCancel={() => setScriptDrag(null)}
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <input
                      key={`${line.playId}-${index}`}
                      aria-label={`Spot for ${line.name}`}
                      title="Type a number to move it there"
                      inputMode="numeric"
                      defaultValue={index + 1}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n - 1 !== index) moveScriptTo(line.playId, n - 1);
                        else e.target.value = String(index + 1);
                      }}
                      className="w-8 h-7 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center text-xs font-black tabular-nums"
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default"
                      disabled={!play || !onDraw}
                      onClick={() => play && openScriptPlay(play)}
                      title={onDraw && play ? 'Open in play builder' : undefined}
                    >
                      <div className="text-sm font-black leading-tight break-words">
                        {look && (
                          <span className="mr-1.5 inline-block rounded px-1.5 py-px align-[1px] text-[9.5px] font-black tracking-wide text-white" style={{ background: look.color }}>
                            {look.label}
                          </span>
                        )}
                        {line.name}
                      </div>
                      {line.detail && <div className={`text-[11px] text-slate-500 ${scriptPics ? '' : 'truncate'}`}>{line.detail}</div>}
                    </button>
                    {(() => {
                      const film = play ? scriptFilm(play) : null;
                      if (!play || !film?.snaps.length) return null;
                      return (
                        <button
                          type="button"
                          title={`Watch their film of this play (${film.snaps.length} clip${film.snaps.length === 1 ? '' : 's'})`}
                          aria-label={`Watch ${line.name}`}
                          onClick={() => openFilmWindow({ gameId: play.gameId, playIds: film.snaps.map((x) => x.id), label: film.group?.label || line.name })}
                          className="shrink-0 h-7 px-1.5 rounded-md border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-[11px] font-black inline-flex items-center gap-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <PlayIcon className="w-3 h-3" /> {film.snaps.length}
                        </button>
                      );
                    })()}
                    <div className="flex items-center shrink-0 text-slate-400">
                      <button type="button" aria-label={`Move ${line.name} to the top`} title="To the top" disabled={index === 0} onClick={() => moveScriptTo(line.playId, 0)} className="p-0.5 disabled:opacity-20 cursor-pointer hover:text-slate-700">
                        <ChevronsUp className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label={`Move ${line.name} up in the script`} disabled={index === 0} onClick={() => reorderScript(index, index - 1)} className="p-0.5 disabled:opacity-20 cursor-pointer hover:text-slate-700">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label={`Move ${line.name} down in the script`} disabled={index === shown.length - 1} onClick={() => reorderScript(index, index + 1)} className="p-0.5 disabled:opacity-20 cursor-pointer hover:text-slate-700">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button type="button" aria-label={`Move ${line.name} to the bottom`} title="To the bottom" disabled={index === shown.length - 1} onClick={() => moveScriptTo(line.playId, shown.length - 1)} className="p-0.5 disabled:opacity-20 cursor-pointer hover:text-slate-700">
                        <ChevronsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {scriptPics &&
                    (diagram ? (
                      <>
                        <button
                          type="button"
                          className="mt-1 block w-full cursor-pointer disabled:cursor-default"
                          disabled={!play || !onDraw}
                          aria-label={`Open ${line.name}`}
                          onClick={() => play && openScriptPlay(play)}
                        >
                          <DiagramImage url={diagram} alt={line.name} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
                        </button>
                        {play && !savedDiagram(play) && <p className="mt-0.5 text-[10px] text-slate-400">Drawn from the play name.</p>}
                      </>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">No diagram yet. Open the play to draw it.</p>
                    ))}
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
