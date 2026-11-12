// The slideshow as a package for another editor (DaVinci Resolve, Final Cut, Premiere): one ZIP with every photo
// (full size, the right way up), each title card as a picture, each clip as its own short video (its slow motion,
// replay and title already in it), the songs, and the timeline laid out the way the app plays it: the pictures and
// clips in order with their times, the songs under them, a marker at each title card. Also YouTube chapters.
import type { FilmAccess } from '../highlights/filmAccess';
import type { HighlightSettings } from '../highlights/types';
import { fileUrl, joinPath } from '../highlights/exporters';
import { drawSlide, slideLook } from './drawSlide';
import { photoBlob } from './photoLoad';
import { renderSlideshowVideo } from './renderSlideshow';
import { bedVolumeOf, mmss, musicLayers, SHAPES, showMusicPieces, slidesSeconds, type Slide } from './slideshowData';
import type { SlideshowOptions } from './types';
import { makeZip, type ZipEntry } from './zip';

export const PKG_FPS = 30;

export interface PkgItem {
  kind: 'still' | 'clip';
  /** Path inside the package ("Photos/003 IMG_1234.jpg"). */
  file: string;
  /** Seconds on the timeline. */
  at: number;
  len: number;
  name: string;
}
export interface PkgMusic {
  file: string;
  name: string;
  /** Where it starts on the timeline, from how far into the song, for how long (seconds). */
  at: number;
  offset: number;
  len: number;
  songSeconds: number;
  /** Which music track (two songs crossfading sit on two tracks), and its fades (seconds). */
  track: number;
  fadeIn: number;
  fadeOut: number;
  /** Its level (dB), and whether it's the background layer. */
  db: number;
  background?: boolean;
}
export interface PkgPlan {
  name: string;
  fps: number;
  width: number;
  height: number;
  /** The folder on the editing computer the ZIP is unzipped into. */
  base: string;
  items: PkgItem[];
  music: PkgMusic[];
  musicDb: number;
  markers: { at: number; title: string }[];
  total: number;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) || 'slide';
const pad = (n: number) => String(n).padStart(3, '0');

/** Where each slide's file goes in the package (photos used twice share one file). */
export function packageFiles(slides: Slide[], songNames: string[]): { slideFile: (string | null)[]; songFile: string[] } {
  const byPhoto = new Map<string, string>();
  const slideFile = slides.map((s, i) => {
    const n = pad(i + 1);
    if (s.kind === 'photo') {
      const had = byPhoto.get(s.item.photoId);
      if (had) return had;
      const f = `Photos/${n} ${safe(s.item.name.replace(/\.[a-z0-9]+$/i, ''))}.jpg`;
      byPhoto.set(s.item.photoId, f);
      return f;
    }
    if (s.kind === 'title') return `Titles/${n} ${safe(s.item.title)}.png`;
    if (s.kind === 'clip') return `Clips/${n} ${safe(s.item.title || s.h.title || 'Clip')}.mp4`;
    return null;
  });
  const songFile = songNames.map((name, k) => `Music/${k + 1} ${safe(name.replace(/\.[a-z0-9]+$/i, ''))}${(/\.[a-z0-9]+$/i.exec(name)?.[0] || '.mp3').toLowerCase()}`);
  return { slideFile, songFile };
}

/** The timeline: slides in order (left-out clips leave out their time too) and the songs under them. */
export function packagePlan(o: {
  name: string;
  slides: Slide[];
  options: SlideshowOptions;
  base: string;
  /** The song files this device has (each once, the background layer's too): name and length. */
  songs: { name: string; seconds: number }[];
  clips: boolean;
}): PkgPlan {
  const shape = SHAPES[o.options.shape] || SHAPES['16:9'];
  const { slideFile, songFile } = packageFiles(o.slides, o.songs.map((s) => s.name));
  const items: PkgItem[] = [];
  const markers: PkgPlan['markers'] = [];
  let at = 0;
  o.slides.forEach((s, i) => {
    const file = slideFile[i];
    if (!file || (s.kind === 'clip' && !o.clips)) return;
    const name = s.kind === 'photo' ? s.item.caption || s.item.name : s.kind === 'title' ? s.item.title : s.kind === 'clip' ? s.item.title || s.h.title || 'Clip' : '';
    if (s.kind === 'title') markers.push({ at, title: s.item.title });
    items.push({ kind: s.kind === 'clip' ? 'clip' : 'still', file, at, len: s.seconds, name });
    at += s.seconds;
  });
  const total = at;
  // The songs, then the background layer: songs that overlap (crossfading) go on a track each, the background on tracks after the songs'.
  const fileOf = new Map(o.songs.map((s, k) => [s.name, k]));
  const layers = musicLayers<number>(o.options, (p) => {
    const k = fileOf.get(p.name);
    return k === undefined ? null : { seconds: o.songs[k].seconds, item: k };
  });
  const dB = (v: number) => Math.round(20 * Math.log10(Math.max(0.001, v)) * 10) / 10;
  const music: PkgMusic[] = [];
  let tracks = 0;
  for (const L of layers) {
    const ends: number[] = [];
    for (const p of showMusicPieces(L.lens, L.repeat, L.delay, 0, total)) {
      let t = ends.findIndex((e) => e <= p.at + 1e-6);
      if (t < 0) t = ends.push(0) - 1;
      ends[t] = p.at + p.seconds;
      const k = L.items[p.song];
      const fadeIn = p.pos < p.fadeIn ? p.fadeIn - p.pos : 0;
      const fadeOut = p.pos + p.seconds > p.len - p.fadeOut ? Math.min(p.seconds, p.fadeOut) : 0;
      music.push({ file: songFile[k], name: o.songs[k].name, at: p.at, offset: p.offset, len: p.seconds, songSeconds: o.songs[k].seconds, track: tracks + t, fadeIn, fadeOut, db: dB(L.name === 'bed' ? bedVolumeOf(o.options) : o.options.musicVolume), background: L.name === 'bed' });
    }
    tracks += ends.length;
  }
  return { name: o.name, fps: PKG_FPS, width: shape.w, height: shape.h, base: o.base, items, music, musicDb: dB(o.options.musicVolume), markers, total };
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fr = (sec: number, fps: number) => Math.round(sec * fps);
const rt = (sec: number, fps: number) => `${fr(sec, fps)}/${fps}s`;
const st = (sec: number) => `${Math.round(sec * 6000)}/6000s`;

/** Final Cut Pro X XML (DaVinci Resolve: File > Import > Timeline). */
export function packageFcpxml(p: PkgPlan): string {
  const { fps } = p;
  const url = (file: string) => esc(fileUrl(joinPath(p.base, ...file.split('/'))));
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE fcpxml>', '<fcpxml version="1.9">', '  <resources>'];
  out.push(`    <format id="r0" name="FFVideoFormat${p.height}p${fps}" frameDuration="1/${fps}s" width="${p.width}" height="${p.height}"/>`);
  out.push(`    <format id="rs" name="FFVideoFormatRateUndefined" width="${p.width}" height="${p.height}"/>`);
  const ids = new Map<string, string>();
  const asset = (file: string, xml: (id: string) => string) => {
    if (ids.has(file)) return ids.get(file)!;
    const id = `a${ids.size + 1}`;
    ids.set(file, id);
    out.push(xml(id));
    return id;
  };
  for (const it of p.items) {
    asset(it.file, (id) =>
      it.kind === 'still'
        ? `    <asset id="${id}" name="${esc(it.file.split('/').pop()!)}" start="0s" duration="0s" hasVideo="1" format="rs">\n      <media-rep kind="original-media" src="${url(it.file)}"/>\n    </asset>`
        : `    <asset id="${id}" name="${esc(it.file.split('/').pop()!)}" start="0s" duration="${rt(it.len, fps)}" hasVideo="1" hasAudio="1" format="r0" audioSources="1" audioChannels="2" audioRate="48000">\n      <media-rep kind="original-media" src="${url(it.file)}"/>\n    </asset>`
    );
  }
  for (const m of p.music) {
    asset(m.file, (id) => `    <asset id="${id}" name="${esc(m.name)}" start="0s" duration="${st(m.songSeconds)}" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000">\n      <media-rep kind="original-media" src="${url(m.file)}"/>\n    </asset>`);
  }
  out.push('  </resources>', '  <library>', '    <event name="Mahopac Slideshows">', `      <project name="${esc(p.name)}">`);
  out.push(`        <sequence format="r0" duration="${rt(p.total, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`, '          <spine>');
  p.items.forEach((it, i) => {
    const kids: string[] = [];
    // The songs ride on the first piece (lane -1, under it), in its own time (it starts at 0).
    if (i === 0)
      for (const m of p.music) {
        kids.push(`              <asset-clip ref="${ids.get(m.file)}" lane="${-1 - m.track}" name="${esc(m.name)}" offset="${rt(m.at, fps)}" start="${st(m.offset)}" duration="${rt(m.len, fps)}">`);
        if (m.db < -0.05) kids.push(`                <adjust-volume amount="${m.db}dB"/>`);
        kids.push('              </asset-clip>');
      }
    for (const mk of p.markers.filter((x) => x.at >= it.at && x.at < it.at + it.len)) kids.push(`              <marker start="${rt(mk.at - it.at, fps)}" duration="1/${fps}s" value="${esc(mk.title)}"/>`);
    const tag = it.kind === 'still' ? 'video' : 'asset-clip';
    const open = `            <${tag} ref="${ids.get(it.file)}" name="${esc(it.name)}" offset="${rt(it.at, fps)}" start="0s" duration="${rt(it.len, fps)}"${it.kind === 'clip' ? ' tcFormat="NDF"' : ''}`;
    if (!kids.length) out.push(`${open}/>`);
    else out.push(`${open}>`, ...kids, `            </${tag}>`);
  });
  out.push('          </spine>', '        </sequence>', '      </project>', '    </event>', '  </library>', '</fcpxml>', '');
  return out.join('\n');
}

/** Final Cut Pro 7 XML (Premiere Pro: File > Import). Pictures and clips on V1, clip sound on A1, songs on A2. */
export function packageXmeml(p: PkgPlan): string {
  const { fps } = p;
  const rate = `<rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`;
  const seen = new Set<string>();
  const fileEl = (file: string, frames: number, video: boolean, audio: boolean) => {
    const id = `f-${file}`;
    if (seen.has(id)) return `<file id="${esc(id)}"/>`;
    seen.add(id);
    const path = esc(fileUrl(joinPath(p.base, ...file.split('/'))).replace('file:///', 'file://localhost/'));
    return `<file id="${esc(id)}"><name>${esc(file.split('/').pop()!)}</name><pathurl>${path}</pathurl>${rate}<duration>${frames}</duration><media>${video ? `<video><samplecharacteristics>${rate}<width>${p.width}</width><height>${p.height}</height></samplecharacteristics></video>` : ''}${audio ? '<audio><channelcount>2</channelcount></audio>' : ''}</media></file>`;
  };
  const v1: string[] = [];
  const a1: string[] = [];
  p.items.forEach((it, i) => {
    const at = fr(it.at, fps);
    const len = Math.max(1, fr(it.len, fps));
    v1.push(`<clipitem id="v1-${i + 1}"><name>${esc(it.name)}</name><duration>${len}</duration>${rate}<start>${at}</start><end>${at + len}</end><in>0</in><out>${len}</out>${fileEl(it.file, len, true, it.kind === 'clip')}</clipitem>`);
    if (it.kind === 'clip')
      a1.push(`<clipitem id="a1-${i + 1}"><name>${esc(it.name)}</name><duration>${len}</duration>${rate}<start>${at}</start><end>${at + len}</end><in>0</in><out>${len}</out>${fileEl(it.file, len, true, true)}<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack></clipitem>`);
  });
  const levelOf = (db: number) => Math.pow(10, db / 20).toFixed(3);
  const songClips = p.music.map((m, i) => {
    const at = fr(m.at, fps);
    const len = Math.max(1, fr(m.len, fps));
    const inF = fr(m.offset, fps);
    const total = Math.max(inF + len, fr(m.songSeconds, fps));
    return `<clipitem id="a2-${i + 1}"><name>${esc(m.name)}</name><duration>${total}</duration>${rate}<start>${at}</start><end>${at + len}</end><in>${inF}</in><out>${inF + len}</out>${fileEl(m.file, total, false, true)}<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack><filter><effect><name>Audio Levels</name><effectid>audiolevels</effectid><effectcategory>audiolevels</effectcategory><effecttype>audiolevels</effecttype><mediatype>audio</mediatype><parameter><parameterid>level</parameterid><name>Level</name><value>${levelOf(m.db)}</value></parameter></effect></filter></clipitem>`;
  });
  // The songs on A2 (and A3 for the ones crossfading over them).
  const songTracks: string[][] = [];
  p.music.forEach((m, i) => (songTracks[m.track || 0] ||= []).push(songClips[i]));
  if (!songTracks.length) songTracks.push([]);
  const markers = p.markers.map((m) => `<marker><name>${esc(m.title)}</name><comment></comment><in>${fr(m.at, fps)}</in><out>-1</out></marker>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="5">',
    `<sequence id="seq1"><name>${esc(p.name)}</name><duration>${fr(p.total, fps)}</duration>${rate}<timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>`,
    `<media><video><format><samplecharacteristics>${rate}<width>${p.width}</width><height>${p.height}</height></samplecharacteristics></format><track>${v1.join('')}</track></video>`,
    `<audio><track>${a1.join('')}</track>${songTracks.map((t) => `<track>${t.join('')}</track>`).join('')}</audio></media>`,
    markers.join(''),
    '</sequence>',
    '</xmeml>',
    '',
  ].join('\n');
}

/** Every piece in order, for a spreadsheet. */
export function packageCsv(p: PkgPlan): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['#', 'Starts', 'Seconds', 'What', 'File'].map(q).join(',')];
  p.items.forEach((it, i) => rows.push([i + 1, mmss(it.at), it.len.toFixed(2), it.name, it.file].map(q).join(',')));
  for (const m of p.music) rows.push(['♪', mmss(m.at), m.len.toFixed(2), `${m.name} (from ${mmss(m.offset)}${m.track ? `, track ${m.track + 1}` : ''}${m.fadeIn ? `, fades in ${m.fadeIn.toFixed(1)} s` : ''}${m.fadeOut ? `, fades out ${m.fadeOut.toFixed(1)} s` : ''})`, m.file].map(q).join(','));
  return rows.join('\r\n');
}

/**
 * YouTube chapters from the title cards ("0:00 Our Season"). YouTube shows chapters when the first is at 0:00 and
 * there are at least three, each 10 seconds or longer; otherwise the list is still there to paste.
 */
export function youtubeChapters(slides: Slide[]): { text: string; works: boolean } {
  const list: { at: number; title: string }[] = [];
  for (const s of slides) if (s.kind === 'title') list.push({ at: s.start, title: s.item.title + (s.item.sub ? ` - ${s.item.sub}` : '') });
  if (!list.length) return { text: '', works: false };
  if (list[0].at > 0.5) list.unshift({ at: 0, title: 'Intro' });
  else list[0].at = 0;
  const total = slidesSeconds(slides);
  const works = list.length >= 3 && list.every((c, i) => (list[i + 1]?.at ?? total) - c.at >= 10);
  return { text: list.map((c) => `${mmss(c.at)} ${c.title}`).join('\n'), works };
}

export function packageReadme(p: PkgPlan, clipsLeftOut: boolean): string {
  return [
    p.name,
    '',
    `Timeline: ${p.width}x${p.height}, ${p.fps} frames a second, ${mmss(p.total)} long.`,
    `It expects this folder at: ${p.base}`,
    '(Somewhere else? Import anyway, then relink the media to wherever you unzipped it.)',
    '',
    'DaVinci Resolve: File > Import > Timeline > "Timeline (Final Cut, Resolve).fcpxml".',
    'Final Cut Pro: File > Import > XML > the same .fcpxml file.',
    'Premiere Pro: File > Import > "Timeline (Premiere).xml".',
    '',
    'What comes in:',
    '  Photos (full size, turned the right way up) and title cards, each for its time, in order.',
    '  Clips as their own short videos, with their slow motion, replay, title and game sound already in them.',
    '  The songs under the pictures, from where the slideshow starts them, at the slideshow\'s volume.',
    '  A marker at each title card.',
    ...(clipsLeftOut ? ['  (Clips were left out of this package, so the timeline runs without them.)'] : []),
    '',
    'Not carried over (redo these in the editor if you want them):',
    '  Fades and wipes between slides: in Resolve, select every clip on the timeline and press Ctrl+T (Cmd+T on a Mac)',
    '    for a cross dissolve at each cut.',
    '  The photos\' slow zoom and drift: Resolve\'s Dynamic Zoom (Inspector) does the same.',
    '  Color looks, darker corners, the logo in the corner and words on photos.',
    '  Music fading in and out and going quieter under game sound.',
    '',
    'Also here: "YouTube chapters.txt" (paste into the YouTube description) and "Shot list.csv".',
    '',
  ].join('\r\n');
}

/** Everything gathered and zipped. */
export async function buildEditorPackage(o: {
  name: string;
  slides: Slide[];
  options: SlideshowOptions;
  access: FilmAccess;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  /** The songs this device has, in the slideshow's order. */
  songs: { name: string; seconds: number; blob: Blob }[];
  base: string;
  clips: boolean;
  signal?: AbortSignal;
  onProgress?: (f: number, label: string) => void;
}): Promise<{ zip: Blob; missing: string[] }> {
  const check = () => {
    if (o.signal?.aborted) throw new DOMException('Stopped.', 'AbortError');
  };
  const plan = packagePlan({ name: o.name, slides: o.slides, options: o.options, base: o.base, songs: o.songs, clips: o.clips });
  const { slideFile, songFile } = packageFiles(o.slides, o.songs.map((s) => s.name));
  const entries: ZipEntry[] = [];
  const missing: string[] = [];
  const done = new Set<string>();
  const W = plan.width;
  const H = plan.height;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const tiny = new OffscreenCanvas(Math.max(8, Math.round(W / 30)), Math.max(8, Math.round(H / 30)));
  const clipCount = o.clips ? o.slides.filter((s) => s.kind === 'clip').length : 0;
  // Clips take most of the time; photos a little; the rest hardly any.
  const weight = (s: Slide) => (s.kind === 'clip' ? (o.clips ? 8 : 0) : s.kind === 'photo' ? 1 : 0.2);
  const all = o.slides.reduce((n, s) => n + weight(s), 0) || 1;
  let sofar = 0;
  for (let i = 0; i < o.slides.length; i++) {
    check();
    const s = o.slides[i];
    const file = slideFile[i];
    const w = weight(s);
    if (!file || done.has(file) || !w) {
      sofar += w;
      continue;
    }
    done.add(file);
    const label = s.kind === 'photo' ? `Photo ${s.item.name}` : s.kind === 'title' ? `Title card ${s.item.title}` : s.kind === 'clip' ? `Clip ${s.h.title || ''}` : '';
    o.onProgress?.((sofar / all) * 0.95, label);
    if (s.kind === 'photo') {
      try {
        entries.push({ name: file, data: await photoBlob(s.item.photoId, 4000) });
      } catch {
        missing.push(s.item.name);
      }
    } else if (s.kind === 'title') {
      drawSlide(ctx, W, H, s, s.seconds / 2, null, { look: o.look, logo: o.logo, tiny, ...slideLook(o.options) });
      entries.push({ name: file, data: await canvas.convertToBlob({ type: 'image/png' }) });
    } else if (s.kind === 'clip') {
      try {
        const one = { ...s, start: 0, fade: 0 };
        const r = await renderSlideshowVideo({
          slides: [one],
          options: { ...o.options, fadeEnds: false, songs: [] },
          access: o.access,
          look: o.look,
          logo: o.logo,
          songs: [],
          quality: 'standard',
          signal: o.signal,
          onProgress: (f) => o.onProgress?.(((sofar + f * w) / all) * 0.95, `${label} (${clipCount} clip${clipCount === 1 ? '' : 's'} to make)`),
        });
        entries.push({ name: file, data: r.blob });
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        missing.push(s.h.title || 'a clip');
      }
    }
    sofar += w;
  }
  o.songs.forEach((s, k) => entries.push({ name: songFile[k], data: s.blob }));
  entries.push({ name: 'Timeline (Final Cut, Resolve).fcpxml', data: packageFcpxml(plan) });
  entries.push({ name: 'Timeline (Premiere).xml', data: packageXmeml(plan) });
  entries.push({ name: 'Shot list.csv', data: packageCsv(plan) });
  const ch = youtubeChapters(o.slides);
  entries.push({ name: 'YouTube chapters.txt', data: ch.text ? `${ch.text}\r\n` : 'Add title cards to the slideshow to get chapters.\r\n' });
  entries.push({ name: 'READ ME.txt', data: packageReadme(plan, !o.clips && o.slides.some((s) => s.kind === 'clip')) });
  check();
  o.onProgress?.(0.96, 'Putting the ZIP together…');
  const zip = await makeZip(entries, (f) => o.onProgress?.(0.96 + f * 0.04, 'Putting the ZIP together…'));
  return { zip, missing };
}
