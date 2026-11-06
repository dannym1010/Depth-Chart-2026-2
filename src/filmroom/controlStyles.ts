// The film player's control look, shared by everything that sits on or over it (the main bar, Play lines, its
// movement bar), so they all read as one set of controls. The player is always dark: its colors are fixed here
// (the app's light and dark themes recolor the gray text shades, which made controls vanish on the black bar).
export const INK = '#e2e8f0';
export const DIM = '#94a3b8';
export const AMBER = { background: '#f59e0b', color: '#111827' };
export const btn =
  'inline-flex items-center justify-center gap-1 h-9 min-w-9 pointer-coarse:h-10 pointer-coarse:min-w-10 px-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40';
/** A button at rest (its text color comes from the player, INK). */
export const idle = `${btn} hover:bg-white/10`;
/** A button that's on. */
export const on = `${btn} bg-indigo-600 text-white`;
/** A thin divider between groups in a bar. */
export const divider = 'w-px h-6 bg-white/15 mx-1 max-sm:hidden';
/** A set of choices (speeds, whose lines): a soft tray, the picked one white. */
export const tray = 'inline-flex items-center gap-0.5 p-0.5 rounded-lg';
export const trayStyle = { background: 'rgba(255,255,255,0.1)' };
export const trayItem = (picked: boolean) =>
  `h-8 pointer-coarse:h-9 min-w-8 px-1.5 rounded-md text-xs font-black transition-colors ${picked ? '' : 'hover:bg-white/10'}`;
export const trayPicked = { background: '#fff', color: '#0f172a' };
/** The round white play / pause button. */
export const playButton = 'inline-flex items-center justify-center h-11 w-11 rounded-full shadow-lg hover:opacity-85 disabled:opacity-40';
export const playButtonStyle = { background: '#fff', color: '#0f172a' };
/** A box of controls over the video (the tools, the movement bar). */
export const overVideo = { background: 'rgba(0,0,0,0.82)', color: INK };
