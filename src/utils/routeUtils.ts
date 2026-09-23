import { UnitType, DepthSubUnit } from '../types';
import { DefensivePositionCategory } from '../components/whiteboard/whiteboardDrillData';

export const VALID_UNITS: Set<string> = new Set([
  'home',
  'mobile_hub',
  'game_day',
  'depth_chart',
  'offense',
  'defense',
  'st',
  'groups',
  'scrimmage',
  'practice_live',
  'wristband',
  'call_sheet',
  'schedule',
  'scouting',
  'hudl_scout',
  'tendencies',
  'html_tendencies',
  'practice',
  'drills',
  'compliance',
  'ppr',
  'guide',
  'whiteboard',
  'users',
]);

export interface RouteState {
  unit: UnitType | null;
  subUnit?: DepthSubUnit;
  drillId?: string;
  drillCategory?: DefensivePositionCategory | 'ALL';
  practiceId?: string;
  openTakeAttendance?: boolean;
}

/**
 * Parses current URL hash into route state.
 * e.g.: #whiteboard?drill=krausko-blitz-master&cat=LB
 *       #practice?practice=plan_1
 *       #compliance?action=take_attendance
 *       #mobile_hub
 */
export function parseRouteHash(hashStr: string): RouteState {
  if (!hashStr || !hashStr.startsWith('#')) {
    return { unit: null };
  }

  const raw = hashStr.slice(1);
  const [pathPart, queryPart] = raw.split('?');
  const unit = VALID_UNITS.has(pathPart) ? (pathPart as UnitType) : null;
  if (!unit) return { unit: null };

  const result: RouteState = { unit };

  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    const sub = params.get('sub');
    if (sub && ['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(sub)) {
      result.subUnit = sub as DepthSubUnit;
    }
    const drill = params.get('drill');
    if (drill) result.drillId = drill;
    const cat = params.get('cat');
    if (cat) result.drillCategory = cat as DefensivePositionCategory | 'ALL';
    const practice = params.get('practice') || params.get('id');
    if (practice) result.practiceId = practice;
    const action = params.get('action');
    if (action === 'take_attendance' || params.get('take_attendance') === 'true') {
      result.openTakeAttendance = true;
    }
  }

  if (['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(unit)) {
    result.subUnit = unit as DepthSubUnit;
  }

  return result;
}

/**
 * Constructs a browser URL hash from unit and optional state parameters.
 */
export function buildRouteHash(
  unit: UnitType,
  options?: {
    subUnit?: DepthSubUnit;
    drillId?: string;
    drillCategory?: DefensivePositionCategory | 'ALL';
    practiceId?: string;
    openTakeAttendance?: boolean;
  }
): string {
  let hash = `#${unit}`;
  const params = new URLSearchParams();

  if (options?.subUnit && unit === 'depth_chart') {
    params.set('sub', options.subUnit);
  }
  if (options?.drillId && (unit === 'whiteboard' || unit === 'drills')) {
    params.set('drill', options.drillId);
  }
  if (options?.drillCategory && (unit === 'whiteboard' || unit === 'drills')) {
    params.set('cat', options.drillCategory);
  }
  if (options?.practiceId && unit === 'practice') {
    params.set('practice', options.practiceId);
  }
  if (options?.openTakeAttendance && unit === 'compliance') {
    params.set('action', 'take_attendance');
  }

  const qs = params.toString();
  if (qs) hash += `?${qs}`;
  return hash;
}
