// A new team starts with its own empty call sheet and wristband (same layout as the program's),
// never a copy of another team's plays.
import type { WristbandData } from '../types';
import type { CallSheetFullData } from '../types/callSheet';
import { INITIAL_TWO_WRISTBANDS_DATA } from '../data/userGameDayPlays';
import { DEFAULT_CALL_SHEET_DATA } from '../data/callSheetData';

const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function blankWristbandData(teamId: string, week: string, teamName?: string): WristbandData {
  const wb = copy(INITIAL_TWO_WRISTBANDS_DATA);
  const label = String(teamName || 'TEAM').toUpperCase();
  for (const band of wb.wristbands || []) {
    // The card's title names this team, not 10U.
    band.title = String(band.title || '').replace(/MAHOPAC\s*10U/i, label);
    for (const col of band.columns || []) {
      // Keep each slot's number; clear the play.
      col.plays = (col.plays || []).map((p) => ({ text: '', customLabel: p.customLabel, wristbandNum: p.wristbandNum }));
    }
  }
  wb.columns = wb.wristbands?.[0]?.columns || [];
  return { ...wb, teamId, week, lastEdited: 0 };
}

export function blankCallSheetData(teamId: string, week: string): CallSheetFullData {
  const cs = copy(DEFAULT_CALL_SHEET_DATA) as CallSheetFullData;
  const clear = (sections: any[] | undefined) =>
    (sections || []).map((s) => ({ ...s, plays: Array.isArray(s.plays) ? s.plays.map(() => null) : s.plays }));
  return {
    ...cs,
    offenseSections: clear(cs.offenseSections),
    defenseSections: clear(cs.defenseSections),
    offenseScript: (cs.offenseScript || []).map(() => null),
    defenseScript: (cs.defenseScript || []).map(() => null),
    opponent: '',
    teamId,
    week,
    lastEdited: 0,
  } as CallSheetFullData;
}
