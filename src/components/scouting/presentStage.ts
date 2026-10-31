import { createContext, useContext } from 'react';

/**
 * Presentation's full screen, for the play builder inside it: the field alone, as big as the screen allows, with
 * nothing on it to edit. `run` goes up each time the coach taps Run (the players move through the play).
 */
export interface PresentStage {
  on: boolean;
  run: number;
}

export const PresentStageContext = createContext<PresentStage>({ on: false, run: 0 });

export const usePresentStage = () => useContext(PresentStageContext);
