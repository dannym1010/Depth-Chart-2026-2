import { WhiteboardDrill } from './whiteboardDrillData';
import { OFFENSE_MATRIX_DRILLS } from './drillsOffense';
import { DEFENSE_MATRIX_DRILLS } from './drillsDefense';
import { OTHER_MATRIX_DRILLS } from './drillsOtherMatrix';

export const DRILL_MATRIX_DRILLS: WhiteboardDrill[] = [
  ...OFFENSE_MATRIX_DRILLS,
  ...DEFENSE_MATRIX_DRILLS,
  ...OTHER_MATRIX_DRILLS,
];
