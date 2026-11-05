import { createContext, useContext } from 'react';

/**
 * Presentation's full screen, for the play builder inside it: the field alone, as big as the screen allows.
 * `run` goes up each time the coach taps Run (the players move through the play).
 * `defenseHud` toggles the on-stage defensive call & adjustment bar.
 */
export interface PresentStage {
  on: boolean;
  run: number;
  defenseHud?: boolean;
  toggleDefenseHud?: () => void;
}

export const PresentStageContext = createContext<PresentStage>({ on: false, run: 0 });

export const usePresentStage = () => useContext(PresentStageContext);
