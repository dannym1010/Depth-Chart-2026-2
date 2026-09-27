import React, { useState, useMemo } from 'react';
import { Play, TeamUnit } from '../types/football';
import { TEAM_UNITS, playIsUnitTaggable } from '../utils/unitStats';
import { isRecordedMotion } from '../utils/csvParser';
import { callUsage, isNumberFormation, isTaggablePlay, restOfSeriesIds, tidyFormation } from '../utils/playTags';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { CallButton, FormationEditor, TagPlaysPanel } from '../../components/playbook/CallPicker';
import { Search, ChevronDown, ChevronUp, Zap, Flame, CheckCircle2, ListChecks } from 'lucide-react';

interface PlaysTableProps {
  plays: Play[];
  /** Our-team log only: tag which unit (Black / Blue / Gold) was on the field. */
  onSetUnit?: (playId: string, unit: TeamUnit | undefined, scope: 'play' | 'rest_of_series') => void;
  /** Tag each play with the Play Bank play that was run. */
  playDatabase?: PlayDatabaseEntry[];
  onTagPlays?: (ids: string[], entry: PlayDatabaseEntry | null) => void;
  onCreateCall?: (name: string, unit: 'offense' | 'defense') => PlayDatabaseEntry;
  /** Edit the formation ("21", "21 R", "32 WB"); tagging then only offers plays from it. */
  onSetFormation?: (ids: string[], formation: string) => void;
}

const UNIT_SHORT: Record<TeamUnit, string> = { black: 'Blk', blue: 'Blu', gold: 'Gld' };

const UnitPicker: React.FC<{
  play: Play;
  onSetUnit: NonNullable<PlaysTableProps['onSetUnit']>;
}> = ({ play, onSetUnit }) => {
  if (!playIsUnitTaggable(play)) return <span className="text-slate-600">—</span>;
  const current = TEAM_UNITS.find((u) => u.id === play.unit);
  return (
    <div className="flex items-center gap-1">
      {TEAM_UNITS.map((u) => {
        const on = play.unit === u.id;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSetUnit(play.id, on ? undefined : u.id, 'play')}
            title={on ? `Clear ${u.label}` : `${u.label} was on the field`}
            aria-label={`${u.label} unit`}
            aria-pressed={on}
            className={`px-1.5 h-6 rounded-md text-[10px] font-black border transition-all cursor-pointer ${
              on ? 'ring-2 ring-white/70' : 'opacity-35 hover:opacity-90'
            }`}
            style={{ backgroundColor: u.swatch, color: u.text, borderColor: u.id === 'black' ? '#64748b' : u.swatch }}
          >
            {UNIT_SHORT[u.id]}
          </button>
        );
      })}
      {current && play.series != null && (
        <button
          type="button"
          onClick={() => onSetUnit(play.id, current.id, 'rest_of_series')}
          title={`Use ${current.label} for the rest of series ${play.series}`}
          className="px-1.5 h-6 rounded-md text-[10px] font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          ↓ series
        </button>
      )}
    </div>
  );
};

export const PlaysTable: React.FC<PlaysTableProps> = ({ plays, onSetUnit, playDatabase, onTagPlays, onCreateCall, onSetFormation }) => {
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [tagging, setTagging] = useState<{ startId?: string } | null>(null);
  const canTagCalls = Boolean(onTagPlays && playDatabase);
  const usage = useMemo(() => callUsage(plays), [plays]);
  const taggable = useMemo(() => plays.filter(isTaggablePlay), [plays]);
  const callsTagged = taggable.filter((p) => p.playCallId).length;
  const needsTag = (p: Play) => (onSetUnit && playIsUnitTaggable(p) && !p.unit) || (canTagCalls && isTaggablePlay(p) && !p.playCallId);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Play>('playNumber');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const handleSort = (field: keyof Play) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredPlays = useMemo(() => {
    let result = plays;
    if ((onSetUnit || canTagCalls) && untaggedOnly) {
      result = result.filter(needsTag);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.playName.toLowerCase().includes(lower) ||
          p.formation.toLowerCase().includes(lower) ||
          p.carrierOrTarget.toLowerCase().includes(lower) ||
          `${p.rusher || ''} ${p.passer || ''} ${p.receiver || ''}`.toLowerCase().includes(lower) ||
          p.result.toLowerCase().includes(lower) ||
          p.playType.toLowerCase().includes(lower)
      );
    }

    return [...result].sort((a, b) => {
      // Play numbers restart each game: keep each game's plays together (games load in upload order).
      if (sortField === 'playNumber' && (a.gameId || '') !== (b.gameId || '')) {
        const byGame = (a.gameId || '') < (b.gameId || '') ? -1 : 1;
        return sortAsc ? byGame : -byGame;
      }
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = (aVal as string).toLowerCase();
        bVal = ((bVal as string) || '').toLowerCase();
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [plays, searchTerm, sortField, sortAsc, onSetUnit, untaggedOnly, canTagCalls]);

  const totalPages = Math.ceil(filteredPlays.length / pageSize) || 1;
  const paginatedPlays = filteredPlays.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>Play-by-Play Film Breakdown</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({filteredPlays.length} Plays)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            {canTagCalls
              ? `${callsTagged} of ${taggable.length} offense and defense plays tagged with a play call.`
              : 'Raw Hudl play records with efficiency, explosive play markers, and target tracking.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
        {canTagCalls && (
          <button
            type="button"
            onClick={() => setTagging({})}
            className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ListChecks className="w-4 h-4" />
            Tag plays
          </button>
        )}
        {(onSetUnit || canTagCalls) && (
          <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={untaggedOnly}
              onChange={(e) => {
                setUntaggedOnly(e.target.checked);
                setPage(1);
              }}
            />
            Needs tags
          </label>
        )}
        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search play, formation, player..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        </div>
      </div>

      {/* Phone cards */}
      <div className="md:hidden divide-y divide-slate-800">
        {paginatedPlays.map((play) => {
          const isGain = play.gainLoss > 0;
          const isLoss = play.gainLoss < 0;
          return (
            <div key={play.id} className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-100 text-sm truncate">{play.playName}</span>
                <span className={`font-mono font-bold text-sm ${isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                  {play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                <span>#{play.playNumber}</span>
                <span>{play.odk}</span>
                <span>Q{play.quarter}</span>
                <span>{play.down} &amp; {play.distance}</span>
                <span>Hash {play.hash}</span>
                <span className={play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'}>
                  {play.playType}
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                {play.formation && play.formation !== '-' ? play.formation : 'No formation'}
                {play.direction ? ` · ${play.direction}` : ''}
                {!hasPlayers(play) && play.carrierOrTarget ? ` · ${play.carrierOrTarget}` : ''}
              </div>
              {hasPlayers(play) && (
                <div className="text-[11px]">
                  <BallPlayers play={play} inline />
                </div>
              )}
              {onSetFormation && play.odk === 'O' && (
                <div className="pt-1">
                  <FormationEditor play={play} plays={plays} db={playDatabase || []} onSetFormation={onSetFormation} compact />
                </div>
              )}
              {((onSetUnit && playIsUnitTaggable(play)) || (canTagCalls && isTaggablePlay(play))) && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  {canTagCalls && isTaggablePlay(play) && (
                    <CallButton play={play} db={playDatabase!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                  )}
                  {onSetUnit && playIsUnitTaggable(play) && <UnitPicker play={play} onSetUnit={onSetUnit} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px] select-none">
            <tr>
              <th onClick={() => handleSort('playNumber')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                <div className="flex items-center gap-1">
                  <span>PL#</span>
                  {sortField === 'playNumber' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('odk')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>ODK</span>
                  {sortField === 'odk' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              {onSetUnit && <th className="py-2.5 px-2">UNIT</th>}
              <th onClick={() => handleSort('quarter')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                QTR
              </th>
              <th onClick={() => handleSort('down')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                <div className="flex items-center gap-1">
                  <span>DN & DIST</span>
                  {sortField === 'down' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('yardLine')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                YARD LN
              </th>
              <th onClick={() => handleSort('hash')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                HASH
              </th>
              <th onClick={() => handleSort('formation')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                FORMATION
              </th>
              <th onClick={() => handleSort('playName')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                PLAY CALL
              </th>
              <th onClick={() => handleSort('carrierOrTarget')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                PLAYERS
              </th>
              <th onClick={() => handleSort('playType')} className="py-2.5 px-2 cursor-pointer hover:text-white">
                TYPE
              </th>
              <th onClick={() => handleSort('direction')} className="py-2.5 px-2 cursor-pointer hover:text-white">
                DIR
              </th>
              <th onClick={() => handleSort('gainLoss')} className="py-2.5 px-3 cursor-pointer hover:text-white text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>GN/LS</span>
                  {sortField === 'gainLoss' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">FLAGS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {paginatedPlays.map((play) => {
              const isGain = play.gainLoss > 0;
              const isLoss = play.gainLoss < 0;

              return (
                <tr key={play.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{play.playNumber}</td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        play.odk === 'O'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : play.odk === 'D'
                          ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
                          : play.odk === 'K'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                      title={
                        play.odk === 'O'
                          ? 'Offense'
                          : play.odk === 'D'
                          ? 'Defense'
                          : play.odk === 'K'
                          ? 'Kick / Special'
                          : play.odk === 'S'
                          ? 'Stoppage'
                          : 'Unknown'
                      }
                    >
                      {play.odk}
                    </span>
                  </td>
                  {onSetUnit && (
                    <td className="py-2 px-2">
                      <UnitPicker play={play} onSetUnit={onSetUnit} />
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-center text-slate-300 font-mono">Q{play.quarter}</td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className="font-bold text-slate-200">
                      {play.down === 0 ? 'Kick' : `${play.down} & ${play.distance}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <span className={play.yardLineSide === 'OPP' ? 'text-rose-300' : 'text-slate-300'}>
                      {play.rawYardLine || `${play.yardLineSide} ${play.yardLine}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={
                        play.hash === 'L' ? 'text-emerald-400' : play.hash === 'R' ? 'text-purple-400' : 'text-sky-400'
                      }
                    >
                      {play.hash}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">
                    {onSetFormation && play.odk === 'O' ? (
                      <FormationCell play={play} plays={plays} onSetFormation={onSetFormation} />
                    ) : play.formation && play.formation !== '-' ? (
                      play.formation
                    ) : (
                      <span className="text-slate-500 font-mono font-normal">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-100">
                    {canTagCalls && isTaggablePlay(play) ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <CallButton play={play} db={playDatabase!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                        {play.playCallId && play.untaggedName && play.untaggedName !== play.playCall && (
                          <span className="text-[10px] text-slate-400">Film: {play.untaggedName}</span>
                        )}
                      </div>
                    ) : (
                      play.playName
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">
                    {hasPlayers(play) ? <BallPlayers play={play} /> : play.carrierOrTarget || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {play.playType}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-400 text-[11px]">{play.direction}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}>
                      {play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {play.isExplosive && (
                        <span title="Explosive Play (>=12 run, >=16 pass)">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                        </span>
                      )}
                      {play.isEfficient && (
                        <span title="Efficient / Converted Play">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      )}
                      {isRecordedMotion(play.motion) && (
                        <span title={`Motion: ${play.motion}`}>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-slate-200">{page}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {tagging && canTagCalls && (
        <TagPlaysPanel
          plays={filteredPlays}
          db={playDatabase!}
          onTag={onTagPlays!}
          onCreate={onCreateCall}
          onSetUnit={onSetUnit ? (id, unit) => onSetUnit(id, unit, 'play') : undefined}
          onSetFormation={onSetFormation}
          startId={tagging.startId}
          title={onSetUnit ? 'Tag our plays' : 'Tag their plays'}
          onClose={() => setTagging(null)}
        />
      )}
    </div>
  );
};

/** Formation in a play-log row: type it (Enter saves), or copy it down the rest of the drive. */
const FormationCell: React.FC<{ play: Play; plays: Play[]; onSetFormation: (ids: string[], formation: string) => void }> = ({
  play,
  plays,
  onSetFormation,
}) => {
  const current = isNumberFormation(play.formation) ? tidyFormation(play.formation) : play.formation === '-' ? '' : play.formation;
  const [draft, setDraft] = useState(current);
  React.useEffect(() => setDraft(current), [current]);
  const rest = restOfSeriesIds(plays, play.id);
  const commit = () => {
    if (tidyFormation(draft) !== tidyFormation(current)) onSetFormation([play.id], draft);
  };
  return (
    <div className="flex items-center gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="21 R"
        aria-label={`Formation for play ${play.playNumber}`}
        className="w-20 h-7 rounded-md border border-slate-700 bg-slate-950 px-1.5 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
      />
      {current && isNumberFormation(current) && rest.length > 0 && (
        <button
          type="button"
          onClick={() => onSetFormation(rest, current)}
          title={`Copy ${current} to the rest of this drive (${rest.length} plays)`}
          aria-label="Copy formation to the rest of the drive"
          className="h-7 w-7 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black cursor-pointer"
        >
          ↓
        </button>
      )}
    </div>
  );
};

const hasPlayers = (p: Play) => Boolean(p.rusher || p.passer || p.receiver);

/** Who had the ball: "Run #13 Landon Veto" / "Pass #21 Nash Ward → #10 Luke M". */
const BallPlayers: React.FC<{ play: Play; inline?: boolean }> = ({ play, inline }) => {
  const rows: [string, string][] = [];
  if (play.rusher) rows.push(['Run', play.rusher]);
  if (play.passer) rows.push(['Pass', play.passer]);
  if (play.receiver) rows.push(['Target', play.receiver]);
  return (
    <span className={inline ? 'flex flex-wrap gap-x-3' : 'flex flex-col gap-0.5'}>
      {rows.map(([label, who]) => (
        <span key={label} className={inline ? 'whitespace-nowrap' : 'block min-w-[96px] max-w-[130px] leading-tight'}>
          <span className={`text-[10px] font-black uppercase text-slate-500 mr-1 ${inline ? '' : 'block'}`}>{label}</span>
          <span className="text-slate-200 font-semibold">{who}</span>
        </span>
      ))}
    </span>
  );
};
