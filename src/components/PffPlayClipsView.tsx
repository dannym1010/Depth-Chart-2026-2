import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, FileSpreadsheet, Link2, ListChecks, Shield, Upload, Users, Zap } from 'lucide-react';
import { FormationBoard, PlacedPlayer, RosterPlayer, UserRole } from '../types';
import type { PlayDatabaseEntry } from '../types/callSheet';
import {
  formatPffAverage,
  PffGradeCriteriaMap,
  PffReviews,
  playerPprKey,
  PprGroup,
  removePffPlay,
  resolvePffCriteria,
  upsertPffPlay,
} from '../utils/pprGroups';
import {
  FilmPlayAssignment,
  FilmPlayerRef,
  FilmSession,
  FilmSlotDef,
  FilmUnitColor,
  FILM_UNIT_COLORS,
  FILM_PACKAGES_COLOR_ORDER,
  FILM_ST_KINDS,
  FilmStKind,
  fillPackagesFromDepth,
  filmPlayLabel,
  filmSlotLabel,
  filmSlotLabelKey,
  filmSlotsForSide,
  filmSlotsForSt,
  filmStKindFromPlay,
  findRosterPlayer,
  hydrateFilmSession,
  HudlImportedPlay,
  mergeHudlPlays,
  stHasPlayers,
  unitHasPlayers,
  parseHudlExportFile,
  playSide,
  remapDeSlotLineup,
  resolvePlayLineup,
} from '../utils/hudlFilmImport';
import { mergeFilmSession } from '../utils/remoteStateMerge';
import { getTeamColorConfig } from './practiceDrillsUtils';
import { ScoutBundle, assignDrives, bundleFromSaved, findSameGame, gamesForWeek, mergeGamePlays, playsForWeek, removeScoutGame } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { tagPlayUnits } from '../hudlScout/utils/unitStats';
import { autoTagFromHudl, callUsage, isNumberFormation, setPlaysFormation, tagPlays } from '../hudlScout/utils/playTags';
import { autoDetectColumnMapping, isSpreadsheetFilename, normalizeHudlRow, parseCsvRows, workbookBufferToCsv } from '../hudlScout/utils/csvParser';
import { formationForCall, lineupFromFormation, moveFilmIntoSharedLog, scoutPlayToFilmPlay } from '../utils/pffFilm';
import { newPlayEntry } from '../utils/playbookImport';
import { setPlaySub } from '../utils/filmLineup';
import { CallButton, FormationEditor, TagPlaysPanel } from './playbook/CallPicker';

/** Our film is one play log: the self-scout upload for a week is what PFF grades for that week. */
export interface PffSharedFilm {
  /** Week being graded (the game that was just played). */
  week: string;
  weekLabel: string;
  teamName: string;
  ownTeamScout?: any;
  onUpdateOwnTeamScout?: (bundle: ScoutBundle) => void;
  playDatabase?: PlayDatabaseEntry[];
  onUpdatePlayDatabase?: (next: PlayDatabaseEntry[]) => void;
}

interface PffPlayClipsViewProps {
  roster: RosterPlayer[];
  priorDepthChart?: Record<string, PlacedPlayer[]>;
  priorFormations?: FormationBoard[];
  reviews: PffReviews;
  onUpdateReviews: (next: PffReviews) => void;
  gradeCriteria: PffGradeCriteriaMap;
  filmSession: FilmSession;
  onUpdateFilmSession: (next: FilmSession) => void;
  userRole: UserRole;
  sharedFilm?: PffSharedFilm;
}

const GRADE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: 'NA', label: 'NA' },
];

function GradeButtons({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {GRADE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`${opt.value === 'NA' ? 'w-7' : 'w-6'} h-6 rounded text-[10px] font-black border cursor-pointer ${
            value === opt.value
              ? opt.value === 'NA'
                ? 'bg-slate-500 text-white border-slate-600'
                : 'bg-cyan-600 text-white border-cyan-700'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function assignmentFor(session: FilmSession, playId: string): FilmPlayAssignment {
  return (
    session.assignments[playId] || {
      color: 'black',
      slotOverrides: {},
      grades: {},
      playerNotes: {},
    }
  );
}

/** Read one of our game files (Hudl CSV / Excel) into play-log plays for a new game. */
async function readGameFile(file: File, gameId: string): Promise<Play[]> {
  const buffer = await file.arrayBuffer();
  const csv = isSpreadsheetFilename(file.name) ? workbookBufferToCsv(buffer) : new TextDecoder().decode(buffer);
  const { headers, rows } = parseCsvRows(csv);
  const mapping = autoDetectColumnMapping(headers);
  return rows.map((r, i) => {
    const p = normalizeHudlRow(r, mapping, i);
    return { ...p, id: `${p.id}-${gameId}-${i}`, gameId };
  });
}

export const PffPlayClipsView: React.FC<PffPlayClipsViewProps> = ({
  roster,
  priorDepthChart,
  priorFormations,
  reviews,
  onUpdateReviews,
  gradeCriteria,
  filmSession,
  onUpdateFilmSession,
  userRole,
  sharedFilm,
}) => {
  const canEdit = userRole === 'admin' || userRole === 'assistant';
  const fileRef = useRef<HTMLInputElement>(null);
  const [activePlayId, setActivePlayId] = useState('');
  const [odkFilter, setOdkFilter] = useState<'all' | 'offense' | 'defense' | 'special'>('all');
  const [showPackages, setShowPackages] = useState(false);
  const [packageSide, setPackageSide] = useState<'offense' | 'defense' | 'special'>('offense');
  const [stKind, setStKind] = useState<FilmStKind>('kickoff');
  const [importError, setImportError] = useState('');
  const [importNote, setImportNote] = useState('');
  const [tagging, setTagging] = useState(false);

  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const sessionRef = useRef(hydrateFilmSession(filmSession));
  const session = mergeFilmSession(sessionRef.current, hydrateFilmSession(filmSession)) || hydrateFilmSession(filmSession);
  sessionRef.current = session;

  // ---- The shared play log (self-scout film for this week) ----
  const teamName = sharedFilm?.teamName || 'Our team';
  const ownBundle = useMemo(() => bundleFromSaved(sharedFilm?.ownTeamScout, teamName), [sharedFilm?.ownTeamScout, teamName]);
  const bundleRef = useRef(ownBundle);
  useEffect(() => {
    if (ownBundle.updatedAt >= bundleRef.current.updatedAt) bundleRef.current = ownBundle;
  }, [ownBundle]);
  const canUseShared = Boolean(sharedFilm?.onUpdateOwnTeamScout);
  const weekGames = sharedFilm ? gamesForWeek(ownBundle, sharedFilm.week) : [];
  const sharedScoutPlays = useMemo(() => (sharedFilm ? playsForWeek(ownBundle, sharedFilm.week) : []), [ownBundle, sharedFilm?.week]);
  const usingShared = sharedScoutPlays.length > 0;
  const scoutById = useMemo(() => new Map(sharedScoutPlays.map((p) => [p.id, p])), [sharedScoutPlays]);
  const allPlays: HudlImportedPlay[] = useMemo(
    () => (usingShared ? sharedScoutPlays.map(scoutPlayToFilmPlay) : session.plays),
    [usingShared, sharedScoutPlays, session.plays]
  );
  const unlinkedGames = canUseShared ? ownBundle.games.filter((g) => !g.week) : [];
  const playDb = sharedFilm?.playDatabase || [];
  const usage = useMemo(() => callUsage(sharedScoutPlays), [sharedScoutPlays]);

  const updateBundle = (fn: (b: ScoutBundle) => ScoutBundle) => {
    if (!sharedFilm?.onUpdateOwnTeamScout) return;
    const next = fn(bundleRef.current);
    bundleRef.current = next;
    sharedFilm.onUpdateOwnTeamScout(next);
  };

  // Black / Gold / Blue follow the week's depth chart unless a coach edited the units.
  const livePackages = useMemo(
    () => fillPackagesFromDepth(roster, priorDepthChart, priorFormations),
    [roster, priorDepthChart, priorFormations]
  );
  const packagesAuto = session.packagesSource === 'auto';
  const effectiveSession: FilmSession = packagesAuto ? { ...session, packages: livePackages } : session;

  useEffect(() => {
    const current = sessionRef.current;
    const staleOrder = current.packagesColorOrder !== FILM_PACKAGES_COLOR_ORDER;
    const keepOff = !staleOrder && unitHasPlayers(current.packages, 'offense');
    const keepDef = !staleOrder && unitHasPlayers(current.packages, 'defense');
    const keepSt = !staleOrder && stHasPlayers(current.packages);
    if (keepOff && keepDef && keepSt) return;
    onUpdateFilmSession({
      ...current,
      packagesColorOrder: FILM_PACKAGES_COLOR_ORDER,
      packagesUpdatedAt: Date.now(),
      packagesSource: keepOff || keepDef || keepSt ? current.packagesSource : 'auto',
      packages: {
        offense: keepOff ? current.packages.offense : livePackages.offense,
        defense: keepDef ? current.packages.defense : livePackages.defense,
        special: keepSt ? current.packages.special : livePackages.special,
      },
    });
  }, [session.packagesColorOrder]);

  const plays = useMemo(() => {
    if (odkFilter === 'all') return allPlays;
    return allPlays.filter((play) => play.odk === odkFilter);
  }, [allPlays, odkFilter]);

  const activePlay = allPlays.find((play) => play.id === activePlayId) || plays[0];

  useEffect(() => {
    if (activePlay && activePlay.id !== activePlayId) setActivePlayId(activePlay.id);
  }, [activePlay?.id]);

  const assignment = activePlay ? assignmentFor(session, activePlay.id) : null;
  const side = activePlay && assignment ? playSide(activePlay, assignment) : 'offense';
  const playStKind =
    activePlay && assignment ? filmStKindFromPlay(activePlay, assignment.stKindOverride) : 'kickoff';
  const activeScoutPlay = activePlay ? scoutById.get(activePlay.id) : undefined;

  /** Unit on the field: the shared play log's Black / Gold / Blue tag wins. */
  const colorOf = (play: HudlImportedPlay): FilmUnitColor =>
    (scoutById.get(play.id)?.unit as FilmUnitColor | undefined) || assignmentFor(session, play.id).color || 'black';
  const activeColor: FilmUnitColor = activePlay ? colorOf(activePlay) : 'black';

  // The called play's formation, from this week's depth chart (e.g. "32 R WISHBONE ..." -> 32 Offense).
  // No call yet: the formation the coach set on the play ("21", "32 WB") picks it.
  const filmFormation = activeScoutPlay && isNumberFormation(activeScoutPlay.formation) ? activeScoutPlay.formation : undefined;
  const callBoard =
    activePlay && side !== 'special'
      ? formationForCall(activePlay.playCall, priorFormations, side) ||
        (side === 'offense' ? formationForCall(filmFormation, priorFormations, side) : undefined)
      : undefined;
  const lineup: { slot: FilmSlotDef; player: FilmPlayerRef | null }[] = useMemo(() => {
    if (!activePlay || !assignment) return [];
    if (callBoard && side !== 'special') {
      // Subs set in the shared play log win over older PFF-only changes.
      const overrides = remapDeSlotLineup({ ...(assignment.slotOverrides || {}), ...(activeScoutPlay?.subs || {}) });
      return lineupFromFormation(callBoard, priorDepthChart, roster, activeColor, side).map(({ slot, player }) => ({
        slot,
        player: Object.prototype.hasOwnProperty.call(overrides, slot.id) ? overrides[slot.id] : player,
      }));
    }
    const withColor: FilmSession = {
      ...effectiveSession,
      assignments: {
        ...effectiveSession.assignments,
        [activePlay.id]: { ...assignment, color: activeColor, slotOverrides: { ...(assignment.slotOverrides || {}), ...(activeScoutPlay?.subs || {}) } },
      },
    };
    return resolvePlayLineup(withColor, activePlay);
  }, [activePlay, activeScoutPlay, assignment, callBoard, side, priorDepthChart, roster, activeColor, effectiveSession]);

  const lineupSource = !activePlay
    ? ''
    : callBoard
      ? `${callBoard.name} · ${sharedFilm?.weekLabel || 'this week'} depth chart`
      : side === 'special'
        ? 'Special teams units'
        : packagesAuto
          ? `Base ${side === 'offense' ? '21' : '4-4'} units · ${sharedFilm?.weekLabel || 'this week'} depth chart`
          : `Base ${side === 'offense' ? '21' : '4-4'} units (edited)`;

  const updateSession = (next: FilmSession) => {
    sessionRef.current = next;
    onUpdateFilmSession(next);
  };

  const patchAssignment = (play: HudlImportedPlay, patch: Partial<FilmPlayAssignment>) => {
    const current = assignmentFor(sessionRef.current, play.id);
    updateSession({
      ...sessionRef.current,
      assignments: {
        ...sessionRef.current.assignments,
        [play.id]: { ...current, ...patch, updatedAt: Date.now() },
      },
    });
  };

  const setUnitColor = (play: HudlImportedPlay, color: FilmUnitColor, scope: 'play' | 'rest_of_series' | 'fill_series' = 'fill_series') => {
    patchAssignment(play, { color });
    if (scoutById.has(play.id)) {
      updateBundle((b) => ({ ...b, plays: tagPlayUnits(b.plays, play.id, color, scope), updatedAt: Date.now() }));
    }
  };

  const setFormation = (ids: string[], formation: string) =>
    updateBundle((b) => ({ ...b, plays: setPlaysFormation(b.plays, ids, formation), updatedAt: Date.now() }));
  const tagCall = (ids: string[], entry: PlayDatabaseEntry | null) =>
    updateBundle((b) => ({ ...b, plays: tagPlays(b.plays, ids, entry), updatedAt: Date.now() }));
  const createCall = (name: string, unit: 'offense' | 'defense') => {
    const entry = newPlayEntry(name, unit);
    sharedFilm?.onUpdatePlayDatabase?.([...playDb, entry]);
    return entry;
  };

  const syncPlayerGrade = (
    play: HudlImportedPlay,
    player: RosterPlayer,
    grades: Record<string, string>,
    note?: string
  ) => {
    const playId = `film_${play.id}`;
    const nums = Object.values(grades).filter((value) => value && value !== 'NA').map(Number).filter((n) => n > 0);
    const hasContent = Object.values(grades).some(Boolean) || Boolean(note);
    if (!hasContent) {
      const next = removePffPlay(reviewsRef.current, player, playId);
      reviewsRef.current = next;
      onUpdateReviews(next);
      return;
    }
    const call = play.playCall || scoutById.get(play.id)?.playCall;
    const next = upsertPffPlay(reviewsRef.current, player, playId, {
      playNumber: play.playNumber,
      grades,
      notes: note || `${call ? `${call} · ` : ''}${filmPlayLabel(play)} · ${play.odk === 'offense' ? 'O' : play.odk === 'defense' ? 'D' : 'ST'}`,
      grade: nums.length ? formatPffAverage(nums.reduce((sum, n) => sum + n, 0) / nums.length) : '',
    });
    reviewsRef.current = next;
    onUpdateReviews(next);
  };

  const onPickFile = async (file: File) => {
    setImportError('');
    setImportNote('');
    // Shared play log: the file becomes this week's game in Self-scout too.
    if (canUseShared && sharedFilm) {
      try {
        const gameId = `game-${Date.now()}`;
        const newPlays = await readGameFile(file, gameId);
        if (!newPlays.length) {
          setImportError('No plays found in that Hudl export.');
          return;
        }
        // Tag plays from the play Hudl says was called (plays a coach already tagged are left alone).
        let autoTagged = 0;
        const tagGame = (b: ScoutBundle, id: string): ScoutBundle => {
          if (!playDb.length) return b;
          const res = autoTagFromHudl(b.plays, playDb, new Set(b.plays.filter((p) => p.gameId === id).map((p) => p.id)));
          autoTagged = res.tagged;
          return res.tagged ? { ...b, plays: res.plays } : b;
        };
        const same = findSameGame(bundleRef.current, newPlays, { week: sharedFilm.week });
        if (same) {
          // Same game again: bring in the new file's details, keep tags, units, subs and grades.
          updateBundle((b) => {
            const merged = mergeGamePlays(b, same.id, newPlays);
            return tagGame({ ...merged, games: merged.games.map((g) => (g.id === same.id ? { ...g, week: sharedFilm.week } : g)) }, same.id);
          });
          setImportNote(`Updated "${same.name}" from ${file.name}. Tags, units and grades were kept${autoTagged ? `; ${autoTagged} plays tagged from Hudl's called play` : ''}.`);
          return;
        }
        if (weekGames.length) {
          const names = weekGames.map((g) => `"${g.name}"`).join(', ');
          if (!window.confirm(`${sharedFilm.weekLabel} already has ${names} in the play log. Replace it with ${file.name}? Grades on the old plays stay in each player's history.`)) return;
        }
        updateBundle((b) => {
          let base = b;
          for (const g of weekGames) base = removeScoutGame(base, g.id, teamName);
          return tagGame({
            ...base,
            plays: [...base.plays, ...assignDrives(newPlays)],
            games: [...base.games, { id: gameId, name: file.name.replace(/\.[^/.]+$/, ''), playCount: newPlays.length, addedAt: Date.now(), week: sharedFilm.week }],
            datasetName: base.datasetName || teamName,
            sourceCleared: false,
            updatedAt: Date.now(),
          }, gameId);
        });
        setActivePlayId(newPlays[0].id);
        setImportNote(`${newPlays.length} plays added for ${sharedFilm.weekLabel}. They also show in Our play log.`);
      } catch {
        setImportError('Could not read that file. Use a Hudl PlaylistData Excel export or a CSV.');
      }
      return;
    }
    try {
      const parsed = await parseHudlExportFile(file);
      if (!parsed.plays.length) {
        setImportError('No plays found in that Hudl export.');
        return;
      }
      updateSession({
        ...session,
        plays: mergeHudlPlays(session.plays, parsed.plays, 'replace'),
        importedAt: Date.now(),
        fileName: parsed.fileName,
      });
      setActivePlayId(parsed.plays[0].id);
    } catch {
      setImportError('Could not read that file. Use a Hudl PlaylistData Excel export.');
    }
  };

  const moveToSharedLog = () => {
    if (!sharedFilm) return;
    const colors: Record<string, FilmUnitColor | undefined> = {};
    session.plays.forEach((p) => (colors[p.id] = session.assignments[p.id]?.color));
    let merged: string | undefined;
    updateBundle((b) => {
      const res = moveFilmIntoSharedLog(b, session.plays, colors, sharedFilm.week, session.fileName?.replace(/\.[^/.]+$/, '') || `${sharedFilm.weekLabel} game`);
      merged = res.mergedDuplicate;
      return res.bundle;
    });
    setImportNote(
      merged
        ? `Moved. "${merged}" was already in Self-scout, so its tags were kept and the two copies are now one.`
        : `Moved. This week's plays now show in Our play log too, with the same tags.`
    );
  };

  const colorBtn = (color: FilmUnitColor, selected: boolean) => {
    const cfg = getTeamColorConfig(color, 'gold');
    return {
      backgroundColor: selected ? cfg.hex : 'transparent',
      color: selected ? (color === 'gold' ? '#0f172a' : '#fff') : undefined,
      borderColor: cfg.hex,
    } as React.CSSProperties;
  };

  const colorDot = (color: FilmUnitColor) => getTeamColorConfig(color, 'gold').hex;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-100">
              {sharedFilm ? `${sharedFilm.weekLabel} game film` : 'Hudl play export'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {usingShared
                ? `Same plays as Hudl Scout → Our play log (${weekGames.map((g) => g.name).join(', ')}). Tag the play call and who was in (Black 1s, Gold 2s, Blue 3s); players fill in from ${sharedFilm?.weekLabel || 'that week'}'s depth chart.`
                : 'Upload PlaylistData.xlsx. ODK tells us O / D / ST. Pick Black (1s), Gold (2s), or Blue (3s) for who was in. Players fill in from that week’s depth chart.'}
            </p>
            {!usingShared && session.fileName ? (
              <p className="text-xs font-bold text-slate-400 mt-1">
                {session.fileName} · {session.plays.length} plays
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onPickFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white"
              >
                <Upload className="w-3.5 h-3.5" />
                {usingShared ? 'Replace game file' : 'Import Hudl export'}
              </button>
              {usingShared && playDb.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTagging(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  Tag plays
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  updateSession({
                    ...session,
                    packagesColorOrder: FILM_PACKAGES_COLOR_ORDER,
                    packagesUpdatedAt: Date.now(),
                    packagesSource: 'auto',
                    packages: livePackages,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700"
              >
                <Users className="w-3.5 h-3.5" />
                Follow depth chart
              </button>
              <button
                type="button"
                onClick={() => setShowPackages((open) => !open)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700"
              >
                Edit units
              </button>
            </div>
          ) : null}
        </div>
        {importError ? <p className="text-sm text-rose-600 mt-3">{importError}</p> : null}
        {importNote ? <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3">{importNote}</p> : null}

        {/* Older PFF-only upload: offer to put it in the shared play log */}
        {canEdit && canUseShared && !usingShared && session.plays.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100 flex-1">
              This week’s film was uploaded to PFF only. Move it into the shared play log so Our play log and PFF use the same plays, tags and units. Grades stay.
            </p>
            <button
              type="button"
              onClick={moveToSharedLog}
              className="px-3 py-2 rounded-xl text-xs font-black bg-amber-600 text-white shrink-0"
            >
              Move to shared play log
            </button>
          </div>
        )}

        {/* Our games that are not linked to a week yet */}
        {canEdit && sharedFilm && !usingShared && unlinkedGames.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link2 className="w-5 h-5 text-slate-500 shrink-0" />
            <p className="text-sm text-slate-700 dark:text-slate-200 flex-1">
              Is one of these Self-scout games the {sharedFilm.weekLabel} game? Link it and PFF grades those plays.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unlinkedGames.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    updateBundle((b) => ({
                      ...b,
                      games: b.games.map((x) => (x.id === g.id ? { ...x, week: sharedFilm.week, editedAt: Date.now() } : x)),
                      updatedAt: Date.now(),
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100"
                >
                  {g.name} ({g.playCount})
                </button>
              ))}
            </div>
          </div>
        )}

        {showPackages && canEdit ? (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={() => setPackageSide('offense')} className={`px-3 py-1.5 rounded-lg text-xs font-black ${packageSide === 'offense' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Zap className="w-3 h-3 inline mr-1" />
                21 offense
              </button>
              <button type="button" onClick={() => setPackageSide('defense')} className={`px-3 py-1.5 rounded-lg text-xs font-black ${packageSide === 'defense' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Shield className="w-3 h-3 inline mr-1" />
                4-4 defense
              </button>
              <button type="button" onClick={() => setPackageSide('special')} className={`px-3 py-1.5 rounded-lg text-xs font-black ${packageSide === 'special' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                Special teams
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              {packagesAuto
                ? 'These follow the depth chart. Changing a player here stops following it until you press “Follow depth chart”. Plays tagged with a call use that formation’s depth chart instead.'
                : 'Edited by hand. Press “Follow depth chart” to go back to the depth chart.'}
            </p>
            {packageSide === 'special' ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {FILM_ST_KINDS.map((kind) => (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => setStKind(kind.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${stKind === kind.id ? 'bg-cyan-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-2">Slot</th>
                    {FILM_UNIT_COLORS.map((color) => (
                      <th key={color.id} className="text-left py-2 px-2">
                        {color.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(packageSide === 'special' ? filmSlotsForSt(stKind) : filmSlotsForSide(packageSide)).map((slot) => {
                    const labelScope = packageSide === 'special' ? `special:${stKind}` : packageSide;
                    const pk = effectiveSession.packages;
                    return (
                    <tr key={slot.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-black">
                        {canEdit ? (
                          <input
                            value={filmSlotLabel(labelScope, slot, session.slotLabels)}
                            onChange={(e) =>
                              updateSession({
                                ...session,
                                packagesUpdatedAt: Date.now(),
                                slotLabels: {
                                  ...(session.slotLabels || {}),
                                  [filmSlotLabelKey(labelScope, slot.id)]: e.target.value,
                                },
                              })
                            }
                            className="w-24 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-black"
                            aria-label={`Rename ${slot.name}`}
                          />
                        ) : (
                          filmSlotLabel(labelScope, slot, session.slotLabels)
                        )}
                      </td>
                      {FILM_UNIT_COLORS.map((color) => {
                        const unitLineup =
                          packageSide === 'special'
                            ? pk.special?.[stKind]?.[color.id] || {}
                            : remapDeSlotLineup(pk[packageSide][color.id]);
                        const value = unitLineup[slot.id];
                        return (
                          <td key={color.id} className="px-2 py-1">
                            <select
                              value={value?.num || ''}
                              onChange={(e) => {
                                const player = roster.find((row) => String(row.num) === e.target.value);
                                const ref = player
                                  ? {
                                      num: player.num,
                                      id: player.id,
                                      name: `${player.firstName} ${player.lastName}`.trim(),
                                    }
                                  : null;
                                const nextPackages =
                                  packageSide === 'special'
                                    ? {
                                        ...pk,
                                        special: {
                                          ...pk.special,
                                          [stKind]: {
                                            ...pk.special?.[stKind],
                                            [color.id]: {
                                              ...(pk.special?.[stKind]?.[color.id] || {}),
                                              [slot.id]: ref,
                                            },
                                          },
                                        },
                                      }
                                    : {
                                        ...pk,
                                        [packageSide]: {
                                          ...pk[packageSide],
                                          [color.id]: {
                                            ...unitLineup,
                                            [slot.id]: ref,
                                          },
                                        },
                                      };
                                updateSession({
                                  ...session,
                                  packagesUpdatedAt: Date.now(),
                                  packagesSource: 'manual',
                                  packages: nextPackages as FilmSession['packages'],
                                });
                              }}
                              className="w-full min-w-[140px] px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            >
                              <option value="">—</option>
                              {roster.map((player) => (
                                <option key={player.id || player.num} value={player.num}>
                                  #{player.num} {player.firstName} {player.lastName}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {allPlays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center text-sm text-slate-500">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          {sharedFilm
            ? `No film for ${sharedFilm.weekLabel} yet. Import the game's Hudl export here, or upload it in Our play log and pick ${sharedFilm.weekLabel}.`
            : 'Import a Hudl PlaylistData export to grade by play.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex gap-1">
              {(['all', 'offense', 'defense', 'special'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setOdkFilter(filter)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                    odkFilter === filter ? 'bg-cyan-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'offense' ? 'O' : filter === 'defense' ? 'D' : 'ST'}
                </button>
              ))}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {plays.map((play) => {
                const selected = play.id === activePlay?.id;
                const color = colorOf(play);
                return (
                  <button
                    key={play.id}
                    type="button"
                    onClick={() => setActivePlayId(play.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 ${
                      selected ? 'bg-cyan-50 dark:bg-cyan-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-sm flex items-center gap-1.5">
                        {play.odk !== 'special' && (
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-400"
                            style={{ backgroundColor: colorDot(color) }}
                            title={`${color} unit`}
                          />
                        )}
                        #{play.playNumber}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                          play.odk === 'offense'
                            ? 'bg-amber-100 text-amber-800'
                            : play.odk === 'defense'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {play.odk === 'offense' ? 'O' : play.odk === 'defense' ? 'D' : play.playType || 'K'}
                      </span>
                    </div>
                    {play.playCall ? (
                      <div className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 truncate">{play.playCall}</div>
                    ) : null}
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                      {filmPlayLabel(play)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Q{play.quarter || '—'} · {play.down || '—'}&{play.distance || '—'} · {play.hash || ''} {play.yardLine || ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activePlay && assignment ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-cyan-700">Play {activePlay.playNumber}</p>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{activePlay.playCall || filmPlayLabel(activePlay)}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {activePlay.playCall ? `${filmPlayLabel(activePlay)} · ` : ''}
                    Q{activePlay.quarter || '—'} · Dn {activePlay.down || '—'} Dist {activePlay.distance || '—'} · Hash {activePlay.hash || '—'} · YL {activePlay.yardLine || '—'}
                    {activePlay.gain ? ` · GN/LS ${activePlay.gain}` : ''}
                  </p>
                </div>
                {activeScoutPlay && side !== 'special' && playDb.length > 0 ? (
                  <div className="shrink-0">
                    <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Play call</div>
                    <CallButton play={activeScoutPlay} db={playDb} usage={usage} onTag={tagCall} onCreate={createCall} disabled={!canEdit} />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase text-slate-500">Side</span>
                {(['offense', 'defense', 'special'] as const).map((odk) => (
                  <button
                    key={odk}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patchAssignment(activePlay, { odkOverride: odk })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
                      side === odk ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {odk === 'offense' ? 'Offense' : odk === 'defense' ? 'Defense' : 'ST'}
                  </button>
                ))}
                <span className="text-[11px] font-black uppercase text-slate-500 ml-2">Unit in</span>
                {FILM_UNIT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setUnitColor(activePlay, color.id)}
                    style={colorBtn(color.id, activeColor === color.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-black border"
                  >
                    {color.label}
                  </button>
                ))}
                {activeScoutPlay?.series != null && side !== 'special' && canEdit && (
                  <button
                    type="button"
                    onClick={() => setUnitColor(activePlay, activeColor, 'rest_of_series')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    title={`Use ${activeColor} for the rest of drive ${activeScoutPlay.series}`}
                  >
                    ↓ rest of drive
                  </button>
                )}
              </div>

              {activeScoutPlay && side === 'offense' && canEdit ? (
                <FormationEditor play={activeScoutPlay} plays={sharedScoutPlays} db={playDb} onSetFormation={setFormation} compact />
              ) : null}

              {side === 'special' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase text-slate-500">ST unit</span>
                  {FILM_ST_KINDS.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => patchAssignment(activePlay, { stKindOverride: kind.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
                        playStKind === kind.id
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {kind.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {lineupSource ? (
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Players from: <span className="text-slate-700 dark:text-slate-200">{lineupSource}</span>
                  {!callBoard && side !== 'special' && activeScoutPlay && !activePlay.playCall ? ' · tag the play call to use its formation' : ''}
                </p>
              ) : null}

              <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-2 font-black">Pos</th>
                        <th className="py-2 pr-2 font-black">Player</th>
                        <th className="py-2 pr-2 font-black">Notes</th>
                        <th className="py-2 font-black">Grades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineup.map(({ slot, player }) => {
                        const rosterPlayer = findRosterPlayer(roster, player);
                        const group = slot.group as PprGroup;
                        const items = resolvePffCriteria(gradeCriteria, group);
                        const playerKey = rosterPlayer ? playerPprKey(rosterPlayer) : '';
                        const grades = (playerKey && assignment.grades[playerKey]) || {};
                        return (
                          <tr key={slot.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                            <td className="py-2 pr-2 font-black whitespace-nowrap">
                              {callBoard ? slot.name : filmSlotLabel(side === 'special' ? `special:${playStKind}` : side, slot, session.slotLabels)}
                            </td>
                            <td className="py-2 pr-2 min-w-[160px]">
                              <select
                                disabled={!canEdit}
                                value={player?.num || ''}
                                onChange={(e) => {
                                  const nextPlayer = roster.find((row) => String(row.num) === e.target.value);
                                  if (activeScoutPlay) {
                                    // Shared play log: the sub is on the play, so Scouting shows it too.
                                    const ref = nextPlayer
                                      ? { num: String(nextPlayer.num), id: nextPlayer.id, name: `${nextPlayer.firstName} ${nextPlayer.lastName}`.trim() }
                                      : null;
                                    updateBundle((b) => ({ ...b, plays: setPlaySub(b.plays, activePlay.id, slot.id, ref), updatedAt: Date.now() }));
                                    return;
                                  }
                                  patchAssignment(activePlay, {
                                    slotOverrides: {
                                      ...assignment.slotOverrides,
                                      [slot.id]: nextPlayer
                                        ? {
                                            num: nextPlayer.num,
                                            id: nextPlayer.id,
                                            name: `${nextPlayer.firstName} ${nextPlayer.lastName}`.trim(),
                                          }
                                        : null,
                                    },
                                  });
                                }}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                              >
                                <option value="">Open</option>
                                {roster.map((row) => (
                                  <option key={row.id || row.num} value={row.num}>
                                    #{row.num} {row.firstName} {row.lastName}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 pr-2 min-w-[180px] max-w-[280px]">
                              {rosterPlayer ? (
                                <input
                                  type="text"
                                  disabled={!canEdit}
                                  value={assignment.playerNotes?.[playerKey] || ''}
                                  onChange={(e) => {
                                    const note = e.target.value;
                                    patchAssignment(activePlay, {
                                      playerNotes: { ...(assignment.playerNotes || {}), [playerKey]: note },
                                    });
                                    syncPlayerGrade(activePlay, rosterPlayer, grades, note);
                                  }}
                                  placeholder="Missed assignment, great block…"
                                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2">
                              {rosterPlayer ? (
                                <div className="flex flex-col gap-1">
                                  {items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2">
                                      <span className="w-24 shrink-0 text-[10px] font-black uppercase text-slate-500">
                                        {item.label}
                                      </span>
                                      <GradeButtons
                                        value={grades[item.id] || ''}
                                        disabled={!canEdit}
                                        onChange={(value) => {
                                          const nextGrades = { ...grades, [item.id]: value };
                                          const nextAll = { ...assignment.grades, [playerKey]: nextGrades };
                                          patchAssignment(activePlay, { grades: nextAll });
                                          syncPlayerGrade(
                                            activePlay,
                                            rosterPlayer,
                                            nextGrades,
                                            assignment.playerNotes?.[playerKey]
                                          );
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Assign a player to grade</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            </div>
          ) : null}
        </div>
      )}

      {tagging && usingShared && (
        <TagPlaysPanel
          plays={sharedScoutPlays}
          db={playDb}
          onTag={tagCall}
          onCreate={createCall}
          onSetUnit={(id, unit) => {
            const fp = allPlays.find((p) => p.id === id);
            if (fp && unit) setUnitColor(fp, unit as FilmUnitColor);
            else updateBundle((b) => ({ ...b, plays: tagPlayUnits(b.plays, id, unit, 'play'), updatedAt: Date.now() }));
          }}
          onSetFormation={setFormation}
          startId={activePlay?.id}
          title={`Tag ${sharedFilm?.weekLabel || 'our'} plays`}
          onClose={() => setTagging(false)}
        />
      )}
    </div>
  );
};
