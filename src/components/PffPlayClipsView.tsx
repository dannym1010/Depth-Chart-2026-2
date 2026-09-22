import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Shield, Upload, Users, Zap } from 'lucide-react';
import { FormationBoard, PlacedPlayer, RosterPlayer, UserRole } from '../types';
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
  FilmSession,
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
}) => {
  const canEdit = userRole === 'admin' || userRole === 'assistant';
  const fileRef = useRef<HTMLInputElement>(null);
  const [activePlayId, setActivePlayId] = useState('');
  const [odkFilter, setOdkFilter] = useState<'all' | 'offense' | 'defense' | 'special'>('all');
  const [showPackages, setShowPackages] = useState(false);
  const [packageSide, setPackageSide] = useState<'offense' | 'defense' | 'special'>('offense');
  const [stKind, setStKind] = useState<FilmStKind>('kickoff');
  const [importError, setImportError] = useState('');

  const reviewsRef = useRef(reviews);
  reviewsRef.current = reviews;
  const sessionRef = useRef(hydrateFilmSession(filmSession));
  const session = mergeFilmSession(sessionRef.current, hydrateFilmSession(filmSession)) || hydrateFilmSession(filmSession);
  sessionRef.current = session;

  useEffect(() => {
    const current = sessionRef.current;
    const filled = fillPackagesFromDepth(roster, priorDepthChart, priorFormations);
    const staleOrder = current.packagesColorOrder !== FILM_PACKAGES_COLOR_ORDER;
    const keepOff = !staleOrder && unitHasPlayers(current.packages, 'offense');
    const keepDef = !staleOrder && unitHasPlayers(current.packages, 'defense');
    const keepSt = !staleOrder && stHasPlayers(current.packages);
    if (keepOff && keepDef && keepSt) return;
    onUpdateFilmSession({
      ...current,
      packagesColorOrder: FILM_PACKAGES_COLOR_ORDER,
      packagesUpdatedAt: Date.now(),
      packages: {
        offense: keepOff ? current.packages.offense : filled.offense,
        defense: keepDef ? current.packages.defense : filled.defense,
        special: keepSt ? current.packages.special : filled.special,
      },
    });
  }, [session.packagesColorOrder]);

  const plays = useMemo(() => {
    if (odkFilter === 'all') return session.plays;
    return session.plays.filter((play) => play.odk === odkFilter);
  }, [session.plays, odkFilter]);

  const activePlay = session.plays.find((play) => play.id === activePlayId) || plays[0];

  useEffect(() => {
    if (activePlay && activePlay.id !== activePlayId) setActivePlayId(activePlay.id);
  }, [activePlay?.id]);

  const assignment = activePlay ? assignmentFor(session, activePlay.id) : null;
  const side = activePlay && assignment ? playSide(activePlay, assignment) : 'offense';
  const playStKind =
    activePlay && assignment ? filmStKindFromPlay(activePlay, assignment.stKindOverride) : 'kickoff';
  const lineup = activePlay ? resolvePlayLineup(session, activePlay) : [];

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
    const next = upsertPffPlay(reviewsRef.current, player, playId, {
      playNumber: play.playNumber,
      grades,
      notes: note || `${filmPlayLabel(play)} · ${play.odk === 'offense' ? 'O' : play.odk === 'defense' ? 'D' : 'ST'}`,
      grade: nums.length ? formatPffAverage(nums.reduce((sum, n) => sum + n, 0) / nums.length) : '',
    });
    reviewsRef.current = next;
    onUpdateReviews(next);
  };

  const onPickFile = async (file: File) => {
    setImportError('');
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
        packagesUpdatedAt: Date.now(),
        packages: (() => {
          const filled = fillPackagesFromDepth(roster, priorDepthChart, priorFormations);
          return {
            offense: unitHasPlayers(session.packages, 'offense') ? session.packages.offense : filled.offense,
            defense: unitHasPlayers(session.packages, 'defense') ? session.packages.defense : filled.defense,
            special: stHasPlayers(session.packages) ? session.packages.special : filled.special,
          };
        })(),
      });
      setActivePlayId(parsed.plays[0].id);
    } catch {
      setImportError('Could not read that file. Use a Hudl PlaylistData Excel export.');
    }
  };

  const colorBtn = (color: FilmUnitColor, selected: boolean) => {
    const cfg = getTeamColorConfig(color, 'gold');
    return {
      backgroundColor: selected ? cfg.hex : 'transparent',
      color: selected ? (color === 'gold' ? '#0f172a' : '#fff') : undefined,
      borderColor: cfg.hex,
    } as React.CSSProperties;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 dark:text-slate-100">Hudl play export</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Upload PlaylistData.xlsx. ODK tells us O / D / ST. Pick Black (1s), Gold (2s), or Blue (3s) for who was in.
              ST plays autofill Kickoff, Kick return, Punt, or FG/2-pt from last week’s special teams depth.
            </p>
            {session.fileName ? (
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
                Import Hudl export
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSession({
                    ...session,
                    packagesColorOrder: FILM_PACKAGES_COLOR_ORDER,
                    packagesUpdatedAt: Date.now(),
                    packages: fillPackagesFromDepth(roster, priorDepthChart, priorFormations),
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700"
              >
                <Users className="w-3.5 h-3.5" />
                Fill Black/Gold/Blue from 21 / 4-4 / ST
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
                        const lineup =
                          packageSide === 'special'
                            ? session.packages.special?.[stKind]?.[color.id] || {}
                            : remapDeSlotLineup(session.packages[packageSide][color.id]);
                        const value = lineup[slot.id];
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
                                        ...session.packages,
                                        special: {
                                          ...session.packages.special,
                                          [stKind]: {
                                            ...session.packages.special?.[stKind],
                                            [color.id]: {
                                              ...(session.packages.special?.[stKind]?.[color.id] || {}),
                                              [slot.id]: ref,
                                            },
                                          },
                                        },
                                      }
                                    : {
                                        ...session.packages,
                                        [packageSide]: {
                                          ...session.packages[packageSide],
                                          [color.id]: {
                                            ...lineup,
                                            [slot.id]: ref,
                                          },
                                        },
                                      };
                                updateSession({
                                  ...session,
                                  packagesUpdatedAt: Date.now(),
                                  packages: nextPackages,
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

      {session.plays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center text-sm text-slate-500">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          Import a Hudl PlaylistData export to grade by play.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4">
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
                      <span className="font-black text-sm">#{play.playNumber}</span>
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
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">{filmPlayLabel(activePlay)}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Q{activePlay.quarter || '—'} · Dn {activePlay.down || '—'} Dist {activePlay.distance || '—'} · Hash {activePlay.hash || '—'} · YL {activePlay.yardLine || '—'}
                    {activePlay.gain ? ` · GN/LS ${activePlay.gain}` : ''}
                  </p>
                </div>
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
                    onClick={() => patchAssignment(activePlay, { color: color.id })}
                    style={colorBtn(color.id, assignment.color === color.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-black border"
                  >
                    {color.label}
                  </button>
                ))}
              </div>

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
                              {filmSlotLabel(side === 'special' ? `special:${playStKind}` : side, slot, session.slotLabels)}
                            </td>
                            <td className="py-2 pr-2 min-w-[160px]">
                              <select
                                disabled={!canEdit}
                                value={player?.num || ''}
                                onChange={(e) => {
                                  const nextPlayer = roster.find((row) => String(row.num) === e.target.value);
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
    </div>
  );
};
