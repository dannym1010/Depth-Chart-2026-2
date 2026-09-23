import { FieldZone, HashPosition, Play, PlayType } from '../types/football';

export interface ColumnMapping {
  playNumber: string;
  odk: string;
  quarter: string;
  down: string;
  distance: string;
  yardLine: string;
  hash: string;
  playType: string;
  formation: string;
  playName: string;
  direction: string;
  gainLoss: string;
  result: string;
  personnel: string;
  carrierOrTarget: string;
  motion: string;
  backfield: string;
  efficiency?: string;
  series?: string;
  oppRusher?: string;
  oppPasser?: string;
  oppReceiver?: string;
}

// Parses raw CSV text into an array of row objects
export function parseCsvRows(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleanText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleanText) return { headers: [], rows: [] };

  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let insideQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        fields.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    // Skip empty lines
    if (values.length === 1 && !values[0]) continue;

    // Detect and skip repeated header rows (e.g. from concatenating multiple Hudl games like Carmel 2 games)
    const isRepeatedHeader =
      values.length > 3 &&
      (values[0].trim().toLowerCase() === headers[0]?.toLowerCase() ||
        (values[0].trim().toLowerCase().includes('play') && values[1]?.trim().toLowerCase().includes('qtr')));
    if (isRepeatedHeader) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const val = values[idx] || '';
      rowObj[header] = val.replace(/^["']|["']$/g, '').trim();
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// Automatically detect best-match columns based on typical Hudl naming conventions
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const findMatch = (candidates: string[]): string => {
    for (const cand of candidates) {
      const found = headers.find(
        (h) => h.toLowerCase() === cand.toLowerCase() || h.toLowerCase().replace(/[^a-z0-9]/g, '') === cand.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (found) return found;
    }
    // Partial search
    for (const cand of candidates) {
      const found = headers.find((h) => h.toLowerCase().includes(cand.toLowerCase()));
      if (found) return found;
    }
    return '';
  };

  return {
    playNumber: findMatch(['PLAY #', 'PLAY NO', 'PLAY', 'PLAY NUMBER', 'PL#', 'NUM']),
    odk: findMatch(['ODK', 'O/D/K', 'O-D-K', 'OFF/DEF', 'POSSESSION', 'UNIT', 'OFF_DEF', 'PLAY ODK', 'ODK UNIT']),
    quarter: findMatch(['QTR', 'QUARTER', 'PERIOD', 'Q']),
    down: findMatch(['DN', 'DOWN', 'DWN', 'D']),
    distance: findMatch(['DIST', 'DISTANCE', 'TOGO', 'TO GO', 'YARDS TO GO']),
    yardLine: findMatch(['YARD LN', 'YARDLN', 'YARD LINE', 'FIELD POS', 'BALL ON', 'YDLN', 'YARD']),
    hash: findMatch(['HASH', 'HSH', 'HS']),
    playType: findMatch(['PLAY TYPE', 'TYPE', 'PASS/RUN', 'RUN/PASS', 'PLAY_TYPE', 'P/R']),
    formation: stringFinder(headers, ['OFF FORM', 'OFF FORMATION', 'FORMATION', 'OFF_FORM', 'FORM']),
    playName: stringFinder(headers, ['OFF PLAY', 'PLAY CALL', 'OFF_PLAY', 'PLAY', 'CALL', 'CONCEPT', 'RESULT']),
    direction: findMatch(['PLAY DIR', 'DIR', 'DIRECTION', 'RUN DIR', 'PLAY_DIR', 'PASS DIR']),
    gainLoss: findMatch(['GN/LS', 'GAIN/LOSS', 'GAIN', 'GN', 'YARDS GAINED', 'YDS', 'RESULT YDS']),
    result: findMatch(['RESULT', 'PASS RESULT', 'PLAY RESULT', 'OUTCOME']),
    personnel: findMatch(['PERSONNEL', 'P-GROUP', 'PERS', 'PERSONNEL GROUP']),
    carrierOrTarget: findMatch(['CARRIER/TARGET', 'CARRIER', 'TARGET', 'BALL CARRIER', 'PASSER', 'BALL']),
    motion: findMatch(['MOTION', 'SHIFT', 'PRE-SNAP MOTION']),
    backfield: findMatch(['BACKFIELD', 'SET', 'BACKFIELD SET']),
    efficiency: findMatch(['EFF', 'EFFICIENCY', 'SUCCESS', 'EFF.']),
    series: findMatch(['SERIES', 'DRIVE']),
    oppRusher: findMatch(['OPP RUSHER', 'RUSHER', 'RUNNER']),
    oppPasser: findMatch(['OPP PASSER', 'PASSER', 'QB']),
    oppReceiver: findMatch(['OPP RECEIVER', 'RECEIVER', 'REC']),
  };
}

function stringFinder(headers: string[], candidates: string[]): string {
  for (const cand of candidates) {
    const exact = headers.find((h) => h.toLowerCase() === cand.toLowerCase());
    if (exact) return exact;
  }
  for (const cand of candidates) {
    const cleaned = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = headers.find((h) => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleaned);
    if (found) return found;
  }
  for (const cand of candidates) {
    const found = headers.find((h) => h.toLowerCase().includes(cand.toLowerCase()));
    if (found) return found;
  }
  return '';
}

// Convert a single raw row into a clean, strongly-typed Play
export function normalizeHudlRow(row: Record<string, string>, mapping: ColumnMapping, index: number): Play {
  const getVal = (colKey: string | undefined, fallback = ''): string => {
    if (!colKey || !row[colKey]) return fallback;
    return row[colKey].trim();
  };

  const playNumVal = parseInt(getVal(mapping.playNumber, String(index + 1)), 10);
  const playNumber = isNaN(playNumVal) ? index + 1 : playNumVal;

  // ODK normalization (Hudl standard: O = Offense, D = Defense, K = Kick/Special, S = Stoppage/Admin)
  const rawOdk = getVal(mapping.odk, '').toUpperCase();
  let odk: Play['odk'] = 'UNKNOWN';
  if (rawOdk === 'O' || rawOdk.startsWith('O') || rawOdk === 'OFFENSE' || rawOdk === 'OFF') odk = 'O';
  else if (rawOdk === 'D' || rawOdk.startsWith('D') || rawOdk === 'DEFENSE' || rawOdk === 'DEF') odk = 'D';
  else if (rawOdk === 'K' || rawOdk.startsWith('K') || rawOdk === 'KICK' || rawOdk === 'SPECIAL') odk = 'K';
  else if (rawOdk === 'S' || rawOdk.startsWith('S') || rawOdk === 'STOP' || rawOdk === 'TIMEOUT') odk = 'S';

  // Quarter
  const qVal = parseInt(getVal(mapping.quarter, '1'), 10);
  const quarter = isNaN(qVal) ? 1 : qVal;

  // Down
  const downStr = getVal(mapping.down, '0').replace(/[^0-9]/g, '');
  const downVal = parseInt(downStr, 10);
  const down = isNaN(downVal) ? 0 : Math.max(0, Math.min(4, downVal));

  // Distance
  const distStr = getVal(mapping.distance, '10').replace(/[^0-9]/g, '');
  const distVal = parseInt(distStr, 10);
  const distance = isNaN(distVal) ? 10 : Math.max(1, distVal);

  // Yard line & Field zone parsing
  const rawYd = getVal(mapping.yardLine, '-25');
  const { normalizedYd, side, zone } = parseYardLine(rawYd);

  // Hash
  const hashRaw = getVal(mapping.hash, 'M').toUpperCase();
  let hash: HashPosition = 'M';
  if (hashRaw.startsWith('L')) hash = 'L';
  else if (hashRaw.startsWith('R')) hash = 'R';

  // Gain / Loss
  const gnStr = getVal(mapping.gainLoss, '0');
  let gainLoss = 0;
  const parsedGn = parseFloat(gnStr.replace(/[^0-9.-]/g, ''));
  if (!isNaN(parsedGn)) gainLoss = parsedGn;

  // Result
  const result = getVal(mapping.result, gainLoss >= 0 ? 'Gain' : 'Loss');

  // Play Type & Play Name
  const rawType = getVal(mapping.playType, '').toUpperCase();
  const rawPlay = getVal(mapping.playName, '');
  const playType = determinePlayType(rawType, rawPlay || result);

  // Play Name fallback: if no explicit play concept column, use result/type description
  let playName = rawPlay;
  if (!playName || playName.toLowerCase() === 'play' || playName === result) {
    if (result && result !== 'Gain' && result !== 'Loss') {
      playName = result;
    } else if (playType === 'RUN') {
      playName = 'Rush';
    } else if (playType === 'PASS') {
      playName = 'Pass';
    } else if (playType === 'SPECIAL') {
      playName = 'Special Teams Play';
    } else {
      playName = 'Play';
    }
  }

  // Direction
  const rawDir = getVal(mapping.direction, 'Middle');
  const direction = normalizeDirection(rawDir, hash);

  // Opponent player attribution (from Hudl columns OPP RUSHER, OPP PASSER, OPP RECEIVER)
  const oppRusher = getVal(mapping.oppRusher, '');
  const oppPasser = getVal(mapping.oppPasser, '');
  const oppReceiver = getVal(mapping.oppReceiver, '');
  const seriesVal = parseInt(getVal(mapping.series, ''), 10);
  const series = isNaN(seriesVal) ? undefined : seriesVal;

  let carrierOrTarget = getVal(mapping.carrierOrTarget, '');
  if (!carrierOrTarget) {
    if (oppRusher) {
      carrierOrTarget = `#${oppRusher} (Rush)`;
    } else if (oppPasser && oppReceiver) {
      carrierOrTarget = `Pass #${oppPasser} to #${oppReceiver}`;
    } else if (oppPasser) {
      carrierOrTarget = `Passer #${oppPasser}`;
    } else if (oppReceiver) {
      carrierOrTarget = `Target #${oppReceiver}`;
    }
  }

  // Efficiency (check Hudl EFF column first: 'Y' or 'N')
  const effVal = getVal(mapping.efficiency, '').toUpperCase();
  let isEfficient = false;
  if (effVal === 'Y' || effVal === 'YES' || effVal === '1' || effVal === 'TRUE') {
    isEfficient = true;
  } else if (effVal === 'N' || effVal === 'NO' || effVal === '0' || effVal === 'FALSE') {
    isEfficient = false;
  } else {
    // Hudl standard situational threshold formula
    if (down === 1) {
      isEfficient = gainLoss >= 4 || gainLoss >= distance * 0.4;
    } else if (down === 2) {
      isEfficient = gainLoss >= distance * 0.5;
    } else if (down === 3 || down === 4) {
      isEfficient = gainLoss >= distance;
    }
  }

  // Explosive play: Run >= 12 yards, Pass >= 16 yards, or long TD
  const isExplosive =
    (playType === 'RUN' && gainLoss >= 12) ||
    ((playType === 'PASS' || playType === 'SCREEN') && gainLoss >= 16) ||
    (result.toLowerCase().includes('td') && gainLoss >= 10);

  // Formation: strictly use the uploaded column if mapped and present; do NOT fabricate fake formations
  const rawFormation = getVal(mapping.formation, '');
  const formation = rawFormation || '-';

  return {
    id: `play-${playNumber}-${index}`,
    playNumber,
    odk,
    quarter,
    down,
    distance,
    yardLine: normalizedYd,
    rawYardLine: rawYd,
    yardLineSide: side,
    fieldZone: zone,
    hash,
    playType,
    formation,
    backfield: getVal(mapping.backfield, '') || '-',
    motion: getVal(mapping.motion, '') || '-',
    playName,
    direction,
    gainLoss,
    result,
    personnel: getVal(mapping.personnel, '') || '-',
    carrierOrTarget,
    oppRusher: oppRusher || undefined,
    oppPasser: oppPasser || undefined,
    oppReceiver: oppReceiver || undefined,
    series,
    isExplosive,
    isEfficient,
  };
}

function parseYardLine(raw: string): { normalizedYd: number; side: 'OWN' | 'OPP' | 'MID'; zone: FieldZone } {
  const clean = raw.trim().toUpperCase();
  let ydNumber = 25;
  let side: 'OWN' | 'OPP' | 'MID' = 'OWN';

  if (clean.includes('50') || clean === '50') {
    return { normalizedYd: 50, side: 'MID', zone: 'plus_territory' };
  }

  // Check prefix notations like -25 (own) vs +30 (opponent) or "OWN 25", "OPP 15"
  if (clean.startsWith('+') || clean.includes('OPP') || clean.includes('PLUS')) {
    side = 'OPP';
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) ydNumber = Math.min(49, Math.max(1, num));
  } else if (clean.startsWith('-') || clean.includes('OWN') || clean.includes('MINUS')) {
    side = 'OWN';
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) ydNumber = Math.min(49, Math.max(1, num));
  } else {
    // Unsigned number (e.g. "35" or "10")
    // In Hudl, negative numbers represent own territory, so unsigned positive numbers indicate opponent side!
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      if (num <= 50) {
        side = 'OPP';
        ydNumber = num;
      } else {
        side = 'OPP';
        ydNumber = 100 - num;
      }
    }
  }

  let zone: FieldZone = 'own_territory';
  if (side === 'OWN') {
    if (ydNumber <= 10) zone = 'backed_up';
    else zone = 'own_territory';
  } else {
    if (ydNumber <= 5) zone = 'goal_line';
    else if (ydNumber <= 20) zone = 'red_zone';
    else zone = 'plus_territory';
  }

  return { normalizedYd: ydNumber, side, zone };
}

function determinePlayType(rawType: string, rawPlay: string): PlayType {
  const combined = (rawType + ' ' + rawPlay).toUpperCase();

  if (combined.includes('PUNT') || combined.includes('FIELD GOAL') || combined.includes('FG') || combined.includes('KICKOFF') || combined.includes('PAT') || combined.includes('EXTRA POINT')) {
    return 'SPECIAL';
  }
  if (combined.includes('SCREEN') || combined.includes('BUBBLE') || combined.includes('TUNNEL')) {
    return 'SCREEN';
  }
  if (combined.includes('RPO')) {
    return 'RPO';
  }
  if (combined.includes('PASS') || combined.includes('VERTS') || combined.includes('SLANT') || combined.includes('POST') || combined.includes('STICK') || combined.includes('MESH') || combined.includes('CORNER') || combined.includes('HITCH') || combined.includes('CROSS') || combined.includes('FADE') || combined.includes('SAIL') || combined.includes('FLOOD') || combined.includes('SMASH')) {
    return 'PASS';
  }
  if (combined.includes('RUN') || combined.includes('ZONE') || combined.includes('POWER') || combined.includes('COUNTER') || combined.includes('SWEEP') || combined.includes('DIVE') || combined.includes('SNEAK') || combined.includes('ISO') || combined.includes('TOSS') || combined.includes('DRAW') || combined.includes('OPTION')) {
    return 'RUN';
  }
  if (rawType.startsWith('R') || rawType === 'RUSH') return 'RUN';
  if (rawType.startsWith('P')) return 'PASS';

  return 'RUN';
}

function normalizeDirection(rawDir: string, hash: HashPosition): string {
  const dir = rawDir.trim().toLowerCase();
  if (dir.includes('bound') || dir === 'b') {
    return hash === 'L' ? 'Left (Boundary)' : hash === 'R' ? 'Right (Boundary)' : 'Boundary';
  }
  if (dir.includes('field') || dir === 'f') {
    return hash === 'L' ? 'Right (Field)' : hash === 'R' ? 'Left (Field)' : 'Field';
  }
  if (dir.includes('left') || dir === 'l') return 'Left';
  if (dir.includes('right') || dir === 'r') return 'Right';
  if (dir.includes('mid') || dir.includes('inside') || dir === 'm') return 'Middle';
  return 'Middle';
}
