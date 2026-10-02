// Play diagrams from Hudl install PDFs: cut from the page, fingerprinted (to spot a changed
// drawing on the next upload) and saved to the team's cloud database. Only the picture's link goes into the
// Play Bank, so the shared team data stays small.
import { useEffect, useState } from 'react';
import { getFirebaseServices } from '../services/storageService';
import type { DiagramDraft } from './playbookImport';

/** Where the field drawing sits on a Hudl install export page (between the title and the position table). */
const DIAGRAM_TOP = 0.064;
const DIAGRAM_BOTTOM = 0.434;
const MAX_WIDTH = 900;

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
export async function diagramFromPage(page: HTMLCanvasElement, band?: { top: number; bottom: number }): Promise<DiagramDraft | undefined> {
  const topRatio = band?.top ?? DIAGRAM_TOP;
  const bottomRatio = band?.bottom ?? DIAGRAM_BOTTOM;
  const top = Math.round(page.height * topRatio);
  const height = Math.round(page.height * (bottomRatio - topRatio));
  const scale = Math.min(1, MAX_WIDTH / page.width);
  const c = document.createElement('canvas');
  c.width = Math.round(page.width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(page, 0, top, page.width, height, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.72));
  if (!blob) return undefined;
  return { hash: fingerprint(c), blob, previewUrl: URL.createObjectURL(blob) };
}

// Diagrams that could not be saved to the cloud, kept for this visit only (by play name key).
const unsaved = new Map<string, string>();
export const unsavedDiagram = (key: string) => unsaved.get(key);

// Diagrams are stored as small pictures in their own documents in the team's cloud database
// (teamData/diagram_*), one per drawing, and the play keeps a "fsdiagram:<doc>" link to it.
// (Firebase Storage needs a paid plan for new projects, so it is not used.)
const DOC_PREFIX = 'fsdiagram:';
const MAX_DOC_CHARS = 900_000; // a Firestore document holds at most ~1 MB

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Save a diagram and return its link. If the cloud can't be reached, the picture is kept
 * for this visit only and null is returned (so nothing temporary goes into the Play Bank).
 */
export async function savePlayDiagram(key: string, diagram: DiagramDraft): Promise<string | null> {
  if (!diagram.blob) return null;
  const { db } = getFirebaseServices();
  if (db) {
    try {
      const image = await blobToDataUrl(diagram.blob);
      if (image.length > MAX_DOC_CHARS) throw new Error('diagram too large');
      const docId = `diagram_${key.toLowerCase().replace(/[^a-z0-9_-]/g, '')}_${diagram.hash.slice(0, 24)}`;
      await Promise.race([
        db.collection('teamData').doc(docId).set({ image, key, hash: diagram.hash, updatedAt: Date.now() }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
      ]);
      loaded.set(docId, image);
      return DOC_PREFIX + docId;
    } catch (err) {
      console.warn('Could not save play diagram', err);
    }
  }
  if (diagram.previewUrl) unsaved.set(key, diagram.previewUrl);
  return null;
}

// Pictures already fetched this visit (doc id -> image), and fetches in flight.
const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

/** The picture for a diagram link (fetched once per visit). */
export function resolveDiagram(url?: string): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  if (!url.startsWith(DOC_PREFIX)) return Promise.resolve(url);
  const docId = url.slice(DOC_PREFIX.length);
  if (loaded.has(docId)) return Promise.resolve(loaded.get(docId)!);
  if (!loading.has(docId)) {
    loading.set(
      docId,
      (async () => {
        try {
          const { db } = getFirebaseServices();
          if (!db) return null;
          const snap = await db.collection('teamData').doc(docId).get();
          const image = snap?.exists ? String(snap.data()?.image || '') : '';
          if (image) loaded.set(docId, image);
          return image || null;
        } catch (err) {
          console.warn('Could not load play diagram', err);
          return null;
        } finally {
          loading.delete(docId);
        }
      })()
    );
  }
  return loading.get(docId)!;
}

/** Shows a diagram link as a picture once it has loaded. */
export function useDiagramSrc(url?: string): string | null {
  const direct = url && !url.startsWith(DOC_PREFIX) ? url : url ? loaded.get(url.slice(DOC_PREFIX.length)) || null : null;
  const [src, setSrc] = useState<string | null>(direct);
  useEffect(() => {
    let alive = true;
    if (direct) {
      setSrc(direct);
      return;
    }
    setSrc(null);
    void resolveDiagram(url).then((img) => alive && setSrc(img));
    return () => {
      alive = false;
    };
  }, [url, direct]);
  return src;
}
