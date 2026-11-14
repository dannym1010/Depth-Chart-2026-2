// A reel as files an editor opens: the timeline (cuts in order, slow motion, freeze frames, titles and spotlights as
// pictures on a second track, a marker on each highlight) in the formats DaVinci Resolve, Premiere, Final Cut and
// most editors read, plus a cut list and YouTube chapters. The editor cuts the original film; nothing is re-encoded.
// The browser can't see drive letters, so file paths come from where the coach says the folders are.
import { chapters, clock, freezeSpotOf, segmentSeconds, type CardSpec, type Overlay, type Segment } from './highlightData';
import type { Highlight, HighlightSettings, SpotStyle } from './types';
import { cameraKeys, clipCamera, fcpTransform, type ClipCam } from './clipZoom';

export interface PlanMedia {
  id: string;
  name: string;
  /** Full path on the editing computer ("J:\Mahopac Film\10U\Week 3 - Shrub Oak\Main\IMG_0001.MOV"). */
  path: string;
  durationSec?: number;
  /**
   * Where the file's own clock (camera timecode) starts, in seconds. An editor finds a clip's moments by that clock:
   * the timeline says "14:22:12" for 2 s into a file that starts at 14:22:10, not "0:02" (which it can't find).
   */
  tcStart?: number;
}

export type GraphicSpec =
  | { kind: 'card'; card: CardSpec }
  | { kind: 'lower'; overlay: Overlay }
  /** `cam`: the clip's zoom at that moment (the spotlight sits where the zoomed picture puts him). */
  | { kind: 'spot'; spot: { x: number; y: number; style: SpotStyle; label?: string }; cam?: ClipCam }
  /** A still of the film at a moment (a freeze frame), zoomed like the clip when it has a zoom. */
  | { kind: 'freeze'; h: Highlight; view: string; clip: string; at: number; cam?: ClipCam };

/** The clip's zoom over a piece: keyframes in the piece's own time (FCPXML's: it starts at `from`). */
export interface PlanCam {
  t: number;
  cam: ClipCam;
}

export interface PlanGraphic {
  id: string;
  /** File name in the reel's Graphics folder. */
  file: string;
  spec: GraphicSpec;
}

/** Track 1: film clips and full-frame pictures (cards, freezes). Times in frames at the timeline rate. */
export type PlanV1 =
  /** `angle`: the camera this clip is the same play from (an export with both cameras). */
  | { kind: 'clip'; media: string; from: number; to: number; speed: number; at: number; len: number; name: string; volumeDb: number; cam?: PlanCam[]; angle?: string }
  | { kind: 'still'; graphic: string; at: number; len: number; name: string };

export interface PlanV2 {
  graphic: string;
  at: number;
  len: number;
  name: string;
}

export interface ExportPlan {
  name: string;
  fps: number;
  width: number;
  height: number;
  v1: PlanV1[];
  v2: PlanV2[];
  markers: { at: number; title: string; note: string }[];
  media: PlanMedia[];
  graphics: PlanGraphic[];
  /** Full path of the Graphics folder on the editing computer. */
  graphicsDir: string;
  total: number;
}

export function frameSize(s: Pick<HighlightSettings, 'shape' | 'size'>): { width: number; height: number } {
  const long = s.size === '2160' ? 3840 : s.size === '720' ? 1280 : 1920;
  const short = s.size === '2160' ? 2160 : s.size === '720' ? 720 : 1080;
  if (s.shape === '9:16') return { width: short, height: long };
  if (s.shape === '1:1') return { width: short, height: short };
  return { width: long, height: short };
}

/** A path joined the way the editing computer writes them (backslashes when the base has them). */
export function joinPath(base: string, ...parts: string[]): string {
  const win = /\\/.test(base) || /^[a-z]:/i.test(base);
  const sep = win ? '\\' : '/';
  const clean = [base.replace(/[\\/]+$/, ''), ...parts.filter(Boolean).map((p) => p.replace(/^[\\/]+|[\\/]+$/g, ''))];
  return clean.join(sep);
}

/** "J:\Mahopac Film\a b.MOV" -> "file:///J:/Mahopac%20Film/a%20b.MOV". */
export function fileUrl(path: string): string {
  const p = path.replace(/\\/g, '/');
  const parts = p.split('/').map((x, i) => (i === 0 && /^[a-z]:$/i.test(x) ? x.toUpperCase() : encodeURIComponent(x)));
  const joined = parts.join('/');
  return joined.startsWith('/') ? `file://${joined}` : `file:///${joined}`;
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'clip';

/**
 * The reel laid out for an editor. `mediaOf` says where each clip's file is on the editing computer;
 * `graphicsDir` is the reel's Graphics folder there.
 */
export function buildPlan(opts: {
  name: string;
  segments: Segment[];
  settings: HighlightSettings;
  /**
   * `base`: a cut copy starts this many seconds into the clip (the segments' times are already shifted by it).
   * `tc`: where the file's own clock starts (camera timecode), in seconds.
   */
  mediaOf: (h: Highlight, view: string, clip: string) => { path: string; durationSec?: number; base?: number; tc?: number };
  graphicsDir: string;
}): ExportPlan {
  const { settings } = opts;
  const fps = settings.fps;
  const { width, height } = frameSize(settings);
  const frames = (sec: number) => Math.max(1, Math.round(sec * fps));
  const volumeDb = settings.gameSound === 'off' ? -96 : settings.gameSound === 'low' ? -12 : 0;
  const media = new Map<string, PlanMedia>();
  const graphics: PlanGraphic[] = [];
  const v1: PlanV1[] = [];
  const v2: PlanV2[] = [];
  const markers: ExportPlan['markers'] = [];
  let at = 0;
  let n = 0;
  const graphic = (spec: GraphicSpec, label: string) => {
    n += 1;
    const id = `g${n}`;
    graphics.push({ id, file: `${String(n).padStart(3, '0')} ${safeName(label)}.png`, spec });
    return id;
  };
  const mediaId = (h: Highlight, view: string, clip: string) => {
    const where = opts.mediaOf(h, view, clip);
    const key = where.path.toLowerCase();
    let m = media.get(key);
    if (!m) {
      m = { id: `m${media.size + 1}`, name: clip, path: where.path, durationSec: where.durationSec, ...(where.tc ? { tcStart: where.tc } : {}) };
      media.set(key, m);
    }
    return m.id;
  };
  // The lower third covers each highlight's own parts (not its replay); one picture per highlight.
  let lower: { hid: string; v2: PlanV2 } | null = null;
  for (const s of opts.segments) {
    const len = frames(segmentSeconds(s));
    if (s.type === 'card') {
      const id = graphic({ kind: 'card', card: s.card }, `${s.card.kind} ${s.card.title}`);
      v1.push({ kind: 'still', graphic: id, at, len, name: s.card.title });
      lower = null;
    } else {
      const own = s.type === 'freeze' || s.part === 'main';
      if (own && lower?.hid !== s.h.id) {
        markers.push({ at, title: s.h.title, note: [s.h.kids.length ? `#${s.h.kids.join(' #')}` : '', s.h.categories.join(', '), '★'.repeat(s.h.rating), s.h.note || ''].filter(Boolean).join(' · ') });
        lower = null;
        if (s.overlay && (s.overlay.title || s.overlay.bug)) {
          const id = graphic({ kind: 'lower', overlay: s.overlay }, `title ${s.h.title}`);
          lower = { hid: s.h.id, v2: { graphic: id, at, len: 0, name: s.h.title } };
          v2.push(lower.v2);
        } else lower = { hid: s.h.id, v2: { graphic: '', at, len: 0, name: '' } };
      }
      if (!own) lower = null;
      if (s.type === 'freeze') {
        // A freeze is never shifted (its still comes from the whole clip).
        const cam = clipCamera(s.h, s.at, 'main') || undefined;
        const id = graphic({ kind: 'freeze', h: s.h, view: s.view, clip: s.clip, at: s.at, ...(cam ? { cam } : {}) }, `freeze ${s.h.title}`);
        v1.push({ kind: 'still', graphic: id, at, len, name: `${s.h.title} (freeze)` });
        const spot = freezeSpotOf(s);
        if (spot) v2.push({ graphic: graphic({ kind: 'spot', spot, ...(cam ? { cam } : {}) }, `spotlight ${s.h.title}`), at, len, name: 'Spotlight' });
      } else {
        // The clip's zoom, from its own (unshifted) seconds, as keyframes in the piece's time (another camera's clip
        // has none: the zoom was set on this one's picture).
        const part = s.part === 'angle' || (s.part === 'replay' && (s.clip !== s.h.clip || s.view !== s.h.view)) ? 'replay' : 'main';
        const base = opts.mediaOf(s.h, s.view, s.clip).base || 0;
        const cam = cameraKeys(s.h, s.from + base, s.to + base, part).map((k) => ({ t: s.from + (k.t - base - s.from) / s.speed, cam: k.cam }));
        const name = s.part === 'replay' ? `${s.h.title} (replay)` : s.part === 'angle' ? `${s.h.title} (${s.view || 'other camera'})` : s.h.title;
        v1.push({
          kind: 'clip', media: mediaId(s.h, s.view, s.clip), from: s.from, to: s.to, speed: s.speed, at, len, name, volumeDb,
          ...(cam.length ? { cam } : {}),
          ...(s.part === 'angle' ? { angle: s.view || 'other camera' } : {}),
        });
      }
      if (own && lower && lower.v2.graphic) lower.v2.len = at + len - lower.v2.at;
    }
    at += len;
  }
  // A spotlight sits on top of the lower third's track: keep both by putting the lower third first.
  return { name: opts.name, fps, width, height, v1, v2: v2.filter((x) => x.graphic && x.len > 0), markers, media: [...media.values()], graphics, graphicsDir: opts.graphicsDir, total: at };
}

/**
 * The part of another camera's clip that is this play: the highlight's trim moved by the offset a coach set between the
 * cameras in the Film Room; with no offset, the whole clip (each camera's clip is one play). Null when nothing is left.
 */
export function angleWindow(h: Pick<Highlight, 'start' | 'end'>, offset: number | undefined, clipLen: number | undefined): { from: number; to: number } | null {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (offset === undefined || !Number.isFinite(offset)) return clipLen && clipLen > 0.2 ? { from: 0, to: r(clipLen) } : null;
  const from = Math.max(0, h.start + offset);
  const to = clipLen ? Math.min(clipLen, h.end + offset) : h.end + offset;
  return to - from >= 0.2 ? { from: r(from), to: r(to) } : null;
}

/** The reel with each play's other camera(s) right after it (after its replay): `angles` by highlight id. */
export function withAngles(segments: Segment[], angles: Map<string, Segment[]>): Segment[] {
  if (!angles.size) return segments;
  const out: Segment[] = [];
  segments.forEach((s, i) => {
    out.push(s);
    if (s.type === 'card') return;
    const next = segments[i + 1];
    // The highlight's last piece: what follows is a card, another highlight, or the end.
    if (!next || next.type === 'card' || next.h.id !== s.h.id) out.push(...(angles.get(s.h.id) || []));
  });
  return out;
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Seconds as an FCPXML time ("123/30s"), in frames of the timeline. */
const rt = (frames: number, fps: number) => `${Math.round(frames)}/${fps}s`;
/** Source seconds as an exact FCPXML time (hundredths of a frame are plenty). */
const st = (sec: number) => `${Math.round(sec * 6000)}/6000s`;

/**
 * A clip's zoom as Final Cut XML's transform (Resolve brings it in as the clip's Zoom and Position, keyframed where it
 * follows a kid). Film is taken as 16:9 (phones and cameras shoot it).
 */
function fcpZoom(cam: PlanCam[] | undefined, W: number, H: number, tc = 0): string[] {
  if (!cam?.length) return [];
  // Keyframe times are the clip's own, which run on the file's clock (its timecode).
  const tf = cam.map((k) => ({ t: tc + k.t, ...fcpTransform(k.cam, W, H) }));
  const first = tf[0];
  const attrs = `position="${first.x} ${first.y}" scale="${first.scale} ${first.scale}"`;
  if (tf.length === 1) return [`              <adjust-transform ${attrs}/>`];
  return [
    `              <adjust-transform ${attrs}>`,
    '                <param name="position">',
    '                  <keyframeAnimation>',
    ...tf.map((k) => `                    <keyframe time="${st(k.t)}" value="${k.x} ${k.y}"/>`),
    '                  </keyframeAnimation>',
    '                </param>',
    '                <param name="scale">',
    '                  <keyframeAnimation>',
    ...tf.map((k) => `                    <keyframe time="${st(k.t)}" value="${k.scale} ${k.scale}"/>`),
    '                  </keyframeAnimation>',
    '                </param>',
    '              </adjust-transform>',
  ];
}

/** Final Cut Pro X XML (DaVinci Resolve reads it too): the default. */
export function toFcpxml(plan: ExportPlan): string {
  const { fps } = plan;
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE fcpxml>', '<fcpxml version="1.9">', '  <resources>');
  out.push(`    <format id="r0" name="FFVideoFormat${plan.height}p${fps}" frameDuration="1/${fps}s" width="${plan.width}" height="${plan.height}"/>`);
  out.push(`    <format id="rs" name="FFVideoFormatRateUndefined" width="${plan.width}" height="${plan.height}"/>`);
  for (const m of plan.media) {
    out.push(
      `    <asset id="${m.id}" name="${esc(m.name)}" start="${st(m.tcStart || 0)}" duration="${st(m.durationSec || 3600)}" hasVideo="1" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000">`,
      `      <media-rep kind="original-media" src="${esc(fileUrl(m.path))}"/>`,
      '    </asset>'
    );
  }
  for (const g of plan.graphics) {
    out.push(
      `    <asset id="${g.id}" name="${esc(g.file)}" start="0s" duration="0s" hasVideo="1" format="rs">`,
      `      <media-rep kind="original-media" src="${esc(fileUrl(joinPath(plan.graphicsDir, g.file)))}"/>`,
      '    </asset>'
    );
  }
  out.push('  </resources>', '  <library>', '    <event name="Mahopac Highlights">', `      <project name="${esc(plan.name)}">`);
  out.push(`        <sequence format="r0" duration="${rt(plan.total, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`, '          <spine>');
  const tcOf = new Map(plan.media.map((m) => [m.id, m.tcStart || 0]));
  for (const c of plan.v1) {
    // Track 2 pictures and markers that start inside this piece ride on it (in its own time).
    const inside = (t: number) => t >= c.at && t < c.at + c.len;
    // A film clip's own time is the file's clock (its timecode): it starts at the timecode plus `from`.
    const tc = c.kind === 'clip' ? tcOf.get(c.media) || 0 : 0;
    // A clip's own time starts at its `from` and runs at the timeline's pace (slowed or not).
    const local = (t: number) => tc + (c.kind === 'clip' ? c.from : 0) + (t - c.at) / fps;
    const kids: string[] = [];
    for (const g of plan.v2.filter((x) => inside(x.at)))
      kids.push(`              <video ref="${g.graphic}" lane="1" name="${esc(g.name)}" offset="${st(local(g.at))}" start="0s" duration="${rt(g.len, fps)}"/>`);
    for (const m of plan.markers.filter((x) => inside(x.at)))
      kids.push(`              <marker start="${st(local(m.at))}" duration="1/${fps}s" value="${esc(m.title)}" note="${esc(m.note)}"/>`);
    if (c.kind === 'still') {
      out.push(`            <video ref="${c.graphic}" name="${esc(c.name)}" offset="${rt(c.at, fps)}" start="0s" duration="${rt(c.len, fps)}"${kids.length ? '>' : '/>'}`);
      if (kids.length) out.push(...kids, '            </video>');
      continue;
    }
    const volume = c.volumeDb ? `              <adjust-volume amount="${c.volumeDb}dB"/>` : '';
    if (c.speed === 1) {
      out.push(`            <asset-clip ref="${c.media}" name="${esc(c.name)}" offset="${rt(c.at, fps)}" start="${st(tc + c.from)}" duration="${rt(c.len, fps)}" tcFormat="NDF">`);
    } else {
      // Slowed down: the clip's own time runs from `from` at the timeline's pace; the time map says which film
      // time shows (its slope is the speed).
      const localEnd = c.from + c.len / fps;
      out.push(
        `            <asset-clip ref="${c.media}" name="${esc(c.name)}" offset="${rt(c.at, fps)}" start="${st(tc + c.from)}" duration="${rt(c.len, fps)}" tcFormat="NDF">`,
        '              <timeMap>',
        `                <timept time="${st(tc + c.from)}" value="${st(tc + c.from)}" interp="linear"/>`,
        `                <timept time="${st(tc + localEnd)}" value="${st(tc + c.to)}" interp="linear"/>`,
        '              </timeMap>'
      );
    }
    out.push(...fcpZoom(c.cam, plan.width, plan.height, tc));
    if (volume) out.push(volume);
    out.push(...kids, '            </asset-clip>');
  }
  out.push('          </spine>', '        </sequence>', '      </project>', '    </event>', '  </library>', '</fcpxml>', '');
  return out.join('\n');
}

/** Final Cut Pro 7 XML (Premiere Pro and DaVinci Resolve read it). */
export function toXmeml(plan: ExportPlan): string {
  const { fps } = plan;
  const rate = `<rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`;
  const out: string[] = [];
  const fileSeen = new Set<string>();
  const fileEl = (id: string, name: string, path: string, frames: number, audio: boolean, tcSec = 0) => {
    if (fileSeen.has(id)) return `<file id="${id}"/>`;
    fileSeen.add(id);
    // The file's own clock (camera timecode), as Premiere writes it.
    const tcFrames = Math.round(tcSec * fps);
    const tcEl = tcFrames ? `<timecode>${rate}<string>${tc(tcFrames, fps)}</string><frame>${tcFrames}</frame><displayformat>NDF</displayformat></timecode>` : '';
    return `<file id="${id}"><name>${esc(name)}</name><pathurl>${esc(fileUrl(path).replace('file:///', 'file://localhost/'))}</pathurl>${rate}<duration>${frames}</duration>${tcEl}<media><video><samplecharacteristics>${rate}<width>${plan.width}</width><height>${plan.height}</height></samplecharacteristics></video>${audio ? '<audio><channelcount>2</channelcount></audio>' : ''}</media></file>`;
  };
  const speedFilter = (speed: number) =>
    speed === 1
      ? ''
      : `<filter><effect><name>Time Remap</name><effectid>timeremap</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter><parameterid>variablespeed</parameterid><name>variablespeed</name><value>0</value></parameter><parameter><parameterid>speed</parameterid><name>speed</name><valuemin>-100000</valuemin><valuemax>100000</valuemax><value>${Math.round(speed * 100)}</value></parameter><parameter><parameterid>reverse</parameterid><name>reverse</name><value>FALSE</value></parameter><parameter><parameterid>frameblending</parameterid><name>frameblending</name><value>FALSE</value></parameter></effect></filter>`;
  const mediaById = new Map(plan.media.map((m) => [m.id, m]));
  const graphicById = new Map(plan.graphics.map((g) => [g.id, g]));
  const v1: string[] = [];
  const a1: string[] = [];
  plan.v1.forEach((c, i) => {
    if (c.kind === 'still') {
      const g = graphicById.get(c.graphic)!;
      v1.push(
        `<clipitem id="v1-${i + 1}"><name>${esc(c.name)}</name><duration>${c.len}</duration>${rate}<start>${c.at}</start><end>${c.at + c.len}</end><in>0</in><out>${c.len}</out>${fileEl(`f${g.id}`, g.file, joinPath(plan.graphicsDir, g.file), c.len, false)}</clipitem>`
      );
      return;
    }
    const m = mediaById.get(c.media)!;
    const total = Math.round((m.durationSec || 3600) * fps);
    const inF = Math.round(c.from * fps);
    const outF = Math.max(inF + 1, Math.round(c.to * fps));
    const item = (id: string, kind: 'video' | 'audio') =>
      `<clipitem id="${id}"><name>${esc(c.name)}</name><duration>${total}</duration>${rate}<start>${c.at}</start><end>${c.at + c.len}</end><in>${inF}</in><out>${outF}</out>${fileEl(`f${c.media}`, m.name, m.path, total, true, m.tcStart)}${kind === 'video' ? speedFilter(c.speed) : c.volumeDb ? `<filter><effect><name>Audio Levels</name><effectid>audiolevels</effectid><effectcategory>audiolevels</effectcategory><effecttype>audiolevels</effecttype><mediatype>audio</mediatype><parameter><parameterid>level</parameterid><name>Level</name><value>${Math.pow(10, c.volumeDb / 20).toFixed(3)}</value></parameter></effect></filter>` : ''}${kind === 'audio' ? '<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>' : ''}</clipitem>`;
    v1.push(item(`v1-${i + 1}`, 'video'));
    // Slowed parts have no sound (it would be stretched).
    if (c.speed === 1 && c.volumeDb > -90) a1.push(item(`a1-${i + 1}`, 'audio'));
  });
  const v2 = plan.v2.map((g, i) => {
    const gr = graphicById.get(g.graphic)!;
    return `<clipitem id="v2-${i + 1}"><name>${esc(g.name)}</name><duration>${g.len}</duration>${rate}<start>${g.at}</start><end>${g.at + g.len}</end><in>0</in><out>${g.len}</out>${fileEl(`f${gr.id}`, gr.file, joinPath(plan.graphicsDir, gr.file), g.len, false)}</clipitem>`;
  });
  const markers = plan.markers.map((m) => `<marker><name>${esc(m.title)}</name><comment>${esc(m.note)}</comment><in>${m.at}</in><out>-1</out></marker>`);
  out.push(
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="5">',
    `<sequence id="seq1"><name>${esc(plan.name)}</name><duration>${plan.total}</duration>${rate}<timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>`,
    `<media><video><format><samplecharacteristics>${rate}<width>${plan.width}</width><height>${plan.height}</height></samplecharacteristics></format>`,
    `<track>${v1.join('')}</track>`,
    `<track>${v2.join('')}</track>`,
    `</video><audio><track>${a1.join('')}</track></audio></media>`,
    markers.join(''),
    '</sequence>',
    '</xmeml>',
    ''
  );
  return out.join('\n');
}

const tc = (frames: number, fps: number) => {
  const f = Math.max(0, Math.round(frames));
  const s = Math.floor(f / fps);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}:${two(f % fps)}`;
};

/** CMX 3600 EDL: cuts in order with clip names and speed changes; one video track (no pictures). */
export function toEdl(plan: ExportPlan): string {
  const { fps } = plan;
  const mediaById = new Map(plan.media.map((m) => [m.id, m]));
  const out = [`TITLE: ${plan.name.slice(0, 60)}`, 'FCM: NON-DROP FRAME', ''];
  let n = 0;
  for (const c of plan.v1) {
    if (c.kind !== 'clip') continue;
    n += 1;
    const m = mediaById.get(c.media)!;
    // Source times on the file's own clock (its camera timecode).
    const srcIn = Math.round(((m.tcStart || 0) + c.from) * fps);
    const srcOut = srcIn + Math.round(c.len * c.speed);
    out.push(`${String(n).padStart(3, '0')}  AX       V     C        ${tc(srcIn, fps)} ${tc(srcOut, fps)} ${tc(c.at, fps)} ${tc(c.at + c.len, fps)}`);
    if (c.speed !== 1) out.push(`M2   AX       ${(fps * c.speed).toFixed(1).padStart(5, '0')}                ${tc(srcIn, fps)}`);
    out.push(`* FROM CLIP NAME: ${m.name}`, `* COMMENT: ${c.name}`, '');
  }
  return out.join('\n');
}

/** OpenTimelineIO (an open format Resolve 18 and newer read): clips, pictures and markers. */
export function toOtio(plan: ExportPlan): string {
  const { fps } = plan;
  const rtime = (frames: number) => ({ OTIO_SCHEMA: 'RationalTime.1', rate: fps, value: Math.round(frames) });
  const range = (start: number, dur: number) => ({ OTIO_SCHEMA: 'TimeRange.1', start_time: rtime(start), duration: rtime(dur) });
  const mediaById = new Map(plan.media.map((m) => [m.id, m]));
  const graphicById = new Map(plan.graphics.map((g) => [g.id, g]));
  const ref = (path: string) => ({ OTIO_SCHEMA: 'ExternalReference.1', target_url: fileUrl(path), available_range: null, metadata: {} });
  const track = (name: string, items: { at: number; len: number; json: any }[], total: number) => {
    const children: any[] = [];
    let t = 0;
    for (const it of items.sort((a, b) => a.at - b.at)) {
      if (it.at > t) children.push({ OTIO_SCHEMA: 'Gap.1', name: '', source_range: range(0, it.at - t), effects: [], markers: [], metadata: {} });
      children.push(it.json);
      t = it.at + it.len;
    }
    if (total > t) children.push({ OTIO_SCHEMA: 'Gap.1', name: '', source_range: range(0, total - t), effects: [], markers: [], metadata: {} });
    return { OTIO_SCHEMA: 'Track.1', name, kind: 'Video', children, effects: [], markers: [], metadata: {} };
  };
  const v1 = plan.v1.map((c) => {
    if (c.kind === 'still') {
      const g = graphicById.get(c.graphic)!;
      return { at: c.at, len: c.len, json: { OTIO_SCHEMA: 'Clip.1', name: c.name, source_range: range(0, c.len), media_reference: ref(joinPath(plan.graphicsDir, g.file)), effects: [], markers: [], metadata: {} } };
    }
    const m = mediaById.get(c.media)!;
    // On the file's own clock (its camera timecode).
    const tcF = Math.round((m.tcStart || 0) * fps);
    const markers = plan.markers
      .filter((k) => k.at >= c.at && k.at < c.at + c.len)
      .map((k) => ({ OTIO_SCHEMA: 'Marker.2', name: k.title, color: 'YELLOW', comment: k.note, marked_range: range(tcF + Math.round(c.from * fps) + (k.at - c.at), 0), metadata: {} }));
    return {
      at: c.at,
      len: c.len,
      json: {
        OTIO_SCHEMA: 'Clip.1',
        name: c.name,
        source_range: range(tcF + Math.round(c.from * fps), c.speed === 1 ? c.len : Math.round(c.len * c.speed)),
        media_reference: { ...ref(m.path), available_range: m.durationSec ? range(tcF, Math.round(m.durationSec * fps)) : null },
        effects: c.speed === 1 ? [] : [{ OTIO_SCHEMA: 'LinearTimeWarp.1', name: '', effect_name: 'LinearTimeWarp', time_scalar: c.speed, metadata: {} }],
        markers,
        metadata: {},
      },
    };
  });
  const v2 = plan.v2.map((g) => {
    const gr = graphicById.get(g.graphic)!;
    return { at: g.at, len: g.len, json: { OTIO_SCHEMA: 'Clip.1', name: g.name, source_range: range(0, g.len), media_reference: ref(joinPath(plan.graphicsDir, gr.file)), effects: [], markers: [], metadata: {} } };
  });
  const timeline = {
    OTIO_SCHEMA: 'Timeline.1',
    name: plan.name,
    global_start_time: rtime(0),
    tracks: { OTIO_SCHEMA: 'Stack.1', name: 'tracks', children: [track('V1', v1, plan.total), track('V2', v2, plan.total)], effects: [], markers: [], metadata: {} },
    metadata: {},
  };
  return JSON.stringify(timeline, null, 2);
}

/** The cut list: every piece in order, for a spreadsheet or a coach without an editor. */
export function toCsv(plan: ExportPlan): string {
  const { fps } = plan;
  const mediaById = new Map(plan.media.map((m) => [m.id, m]));
  const graphicById = new Map(plan.graphics.map((g) => [g.id, g]));
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['#', 'Reel time', 'Length (s)', 'What', 'File', 'From (s)', 'To (s)', 'Speed'].map(q).join(',')];
  plan.v1.forEach((c, i) => {
    const file = c.kind === 'clip' ? mediaById.get(c.media)!.path : joinPath(plan.graphicsDir, graphicById.get(c.graphic)!.file);
    rows.push([i + 1, clock(c.at / fps), (c.len / fps).toFixed(2), c.name, file, c.kind === 'clip' ? c.from.toFixed(2) : '', c.kind === 'clip' ? c.to.toFixed(2) : '', c.kind === 'clip' ? c.speed : ''].map(q).join(','));
  });
  return rows.join('\r\n');
}

/** The other cameras a both-cameras export has plays from ("Field"). */
const angleViews = (plan: ExportPlan) => [...new Set(plan.v1.flatMap((c) => (c.kind === 'clip' && c.angle ? [c.angle] : [])))];

/** How to open it in Resolve (written next to the timeline). */
export function readMe(plan: ExportPlan, timelineFile: string): string {
  return [
    `${plan.name}`,
    '',
    'DaVinci Resolve:',
    `  1. File > Import > Timeline, and pick "${timelineFile}".`,
    '  2. Let it import the source clips into the media pool.',
    '  3. Clips that show "Media Offline": select them in the media pool, Relink, and pick the film folder.',
    '',
    `Timeline: ${plan.width}x${plan.height}, ${plan.fps} frames a second, ${clock(plan.total / plan.fps)} long.`,
    'Track 1: the film, title cards and freeze frames. Track 2: titles and spotlights (see-through pictures).',
    'Each highlight has a marker with its title, kids, kind and rating.',
    ...(plan.media.some((m) => m.tcStart)
      ? ["Clips are placed by each camera file's own clock (its timecode), the way Resolve finds them."]
      : []),
    ...(angleViews(plan).length
      ? [
          '',
          `Both cameras: right after each play is the same play from the ${angleViews(plan).join(' / ')} camera (its name ends in "(${angleViews(plan)[0]})").`,
          '  Keep the angle you like, or cut between them; delete the rest.',
        ]
      : []),
    ...(plan.v1.some((c) => c.kind === 'clip' && c.cam?.length)
      ? [
          '',
          'Zoomed clips: the zoom (and the camera following a kid) comes in with the .fcpxml timeline as each clip\'s',
          '  Zoom and Position in the Inspector (keyframed where it follows him). When importing, leave',
          '  "Use sizing information" ticked. The .xml, .edl and .otio timelines show those clips whole.',
        ]
      : []),
    '',
    'Premiere Pro: File > Import, the .xml file.  Final Cut Pro: File > Import > XML, the .fcpxml file.',
    '',
    'Film used:',
    ...plan.media.map((m) => `  ${m.path}`),
    '',
  ].join('\r\n');
}

export { chapters };
