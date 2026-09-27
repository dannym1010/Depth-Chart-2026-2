// Play diagrams from Hudl install PDFs: cut from the page, fingerprinted (to spot a changed
// drawing on the next upload) and saved to cloud storage. Only the picture's link goes into the
// Play Bank, so the shared team data stays small.
import { getFirebaseServices } from '../services/storageService';
import type { DiagramDraft } from './playbookImport';

/** Where the field drawing sits on a Hudl install export page (between the title and the position table). */
const DIAGRAM_TOP = 0.064;
const DIAGRAM_BOTTOM = 0.434;
const MAX_WIDTH = 1000;

/** Rough fingerprint of a picture: 48x20 grey cells, each darker or lighter than average. */
function fingerprint(src: HTMLCanvasElement): string {
  const w = 48;
  const h = 20;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const grey: number[] = [];
  for (let i = 0; i < px.length; i += 4) grey.push(px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11);
  const mean = grey.reduce((a, b) => a + b, 0) / grey.length;
  let hex = '';
  for (let i = 0; i < grey.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 1) | (grey[i + j] < mean ? 1 : 0);
    hex += n.toString(16);
  }
  return hex;
}

/** Cut the play drawing out of a rendered install page. */
export async function diagramFromPage(page: HTMLCanvasElement): Promise<DiagramDraft | undefined> {
  const top = Math.round(page.height * DIAGRAM_TOP);
  const height = Math.round(page.height * (DIAGRAM_BOTTOM - DIAGRAM_TOP));
  const scale = Math.min(1, MAX_WIDTH / page.width);
  const c = document.createElement('canvas');
  c.width = Math.round(page.width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(page, 0, top, page.width, height, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8));
  if (!blob) return undefined;
  return { hash: fingerprint(c), blob, previewUrl: URL.createObjectURL(blob) };
}

// Diagrams that could not be saved to the cloud, kept for this visit only (by play name key).
const unsaved = new Map<string, string>();
export const unsavedDiagram = (key: string) => unsaved.get(key);

/**
 * Save a diagram and return its link. If cloud storage can't be reached, the picture is kept
 * for this visit only and null is returned (so nothing temporary goes into the Play Bank).
 */
export async function savePlayDiagram(key: string, diagram: DiagramDraft): Promise<string | null> {
  if (!diagram.blob) return null;
  const { storage } = getFirebaseServices();
  if (storage) {
    try {
      const ref = storage.ref(`play_diagrams/${key.toLowerCase()}_${diagram.hash.slice(0, 24)}.jpg`);
      const snap = await Promise.race([
        ref.put(diagram.blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000)),
      ]);
      return String(await (snap as any).ref.getDownloadURL());
    } catch (err) {
      console.warn('Could not save play diagram', err);
    }
  }
  if (diagram.previewUrl) unsaved.set(key, diagram.previewUrl);
  return null;
}
