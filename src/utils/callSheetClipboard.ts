import { CallSheetPlay } from '../types/callSheet';
import { safeJSONParse, safeJSONSet } from '../services/storageService';

const CLIPBOARD_STORAGE_KEY = 'footballCallSheetCopiedPlay';
const CLIPBOARD_EVENT_NAME = 'callSheetClipboardChange';

/**
 * Retrieves the currently copied play from the call sheet clipboard.
 */
export function getCopiedPlay(): CallSheetPlay | null {
  return safeJSONParse<CallSheetPlay | null>(CLIPBOARD_STORAGE_KEY, null);
}

/**
 * Copies a play into the call sheet clipboard and notifies all listening cells.
 */
export function setCopiedPlay(play: CallSheetPlay | null): void {
  safeJSONSet(CLIPBOARD_STORAGE_KEY, play);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT_NAME, { detail: play }));
    if (play && play.name && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(play.name).catch(() => {});
    }
  }
}

/**
 * Subscribes to clipboard updates across all situation tables and cells.
 */
export function subscribeCopiedPlay(callback: (play: CallSheetPlay | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<CallSheetPlay | null>;
    callback(custom.detail !== undefined ? custom.detail : getCopiedPlay());
  };
  window.addEventListener(CLIPBOARD_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(CLIPBOARD_EVENT_NAME, handler);
  };
}
