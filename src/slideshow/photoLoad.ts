// A slideshow's photos from Google Drive: Drive's own resized copy (quick, and already turned the right way up), else
// the photo itself. Only the file id is saved with the slideshow; the rest is asked for when it's shown.
import { ALL_DRIVES, API, driveAccessToken, driveFetch } from '../filmroom/filmSources';
import { drivePhotoBlob, drivePhotoThumb, listDrivePhotos } from '../media/mediaSources';
import type { DrivePhoto } from '../media/types';

// Folders listed this visit (Drive is asked once per folder).
const listed = new Map<string, Promise<DrivePhoto[]>>();
export function folderPhotos(driveId: string): Promise<DrivePhoto[]> {
  let p = listed.get(driveId);
  if (!p) {
    p = listDrivePhotos(driveId);
    p.catch(() => listed.delete(driveId));
    listed.set(driveId, p);
  }
  return p;
}

/** When photos were taken (by Drive file id), from their folders' listings. */
export async function photoTimes(folders: { id: string; driveId: string }[], want: { photoId: string; folderId: string }[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const byFolder = new Set(want.map((w) => w.folderId));
  for (const f of folders) {
    if (!byFolder.has(f.id)) continue;
    try {
      for (const p of await folderPhotos(f.driveId)) if (p.takenAt) out[p.id] = p.takenAt;
    } catch {
      /* a folder that can't be read: its photos keep their places */
    }
  }
  return out;
}

type Meta = { thumbnailLink?: string; width?: number; height?: number };
const metas = new Map<string, Promise<Meta>>();

/** What Drive knows about a photo (its resized-copy link expires, so it's asked for again each visit). */
export function photoMeta(id: string): Promise<Meta> {
  let p = metas.get(id);
  if (!p) {
    p = driveFetch(`${API}/${encodeURIComponent(id)}?fields=thumbnailLink,imageMediaMetadata(width,height)&${ALL_DRIVES}`)
      .then((r) => r.json())
      .then((f) => ({ thumbnailLink: f.thumbnailLink, width: f.imageMediaMetadata?.width, height: f.imageMediaMetadata?.height }));
    p.catch(() => metas.delete(id));
    metas.set(id, p);
  }
  return p;
}

/** The photo about `size` pixels on its long side. */
export async function photoBlob(id: string, size: number): Promise<Blob> {
  const token = driveAccessToken();
  try {
    const m = await photoMeta(id);
    if (m.thumbnailLink && token) {
      const res = await fetch(m.thumbnailLink.replace(/=s\d+(-\w+)*$/, `=s${Math.round(size)}`), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const b = await res.blob();
        if (b.size > 1000) return b;
      }
    }
  } catch {
    /* the photo itself, below */
  }
  return drivePhotoBlob(id);
}

/** Ready to draw. */
export async function photoBitmap(id: string, size: number): Promise<ImageBitmap> {
  const blob = await photoBlob(id, size);
  return createImageBitmap(blob);
}

/** A small picture for the slide list. */
export async function photoThumb(id: string, size = 240): Promise<string> {
  let link: string | undefined;
  try {
    link = (await photoMeta(id)).thumbnailLink;
  } catch {
    /* the photo itself */
  }
  return drivePhotoThumb({ id, thumbnailLink: link }, size);
}

/** A few photos kept ready (the player shows one after another; going back shows the last ones again). */
export function bitmapCache(size: number, keep = 8) {
  const m = new Map<string, Promise<ImageBitmap>>();
  const get = (id: string): Promise<ImageBitmap> => {
    const hit = m.get(id);
    if (hit) {
      m.delete(id);
      m.set(id, hit);
      return hit;
    }
    const p = photoBitmap(id, size);
    p.catch(() => m.delete(id));
    m.set(id, p);
    while (m.size > keep) {
      const [oldest, bm] = m.entries().next().value as [string, Promise<ImageBitmap>];
      m.delete(oldest);
      void bm.then((b) => b.close()).catch(() => undefined);
    }
    return p;
  };
  const clear = () => {
    for (const p of m.values()) void p.then((b) => b.close()).catch(() => undefined);
    m.clear();
  };
  return { get, clear };
}
