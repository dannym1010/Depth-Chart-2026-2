// One frame of a slideshow: a photo (slowly moving, filling the frame or whole with a soft copy behind it), a title
// card, or a clip's film with its circles and title, then the fade over it (the last slide dissolving away, or a
// black / white veil). The in-app player and the MP4 draw with this, so they look the same.
import { drawCard } from '../highlights/graphics';
import type { Segment } from '../highlights/highlightData';
import type { HighlightSettings } from '../highlights/types';
import { drawHighlightFrame, drawSocialTitle } from '../highlights/socialVideo';
import { fitsByFilling, photoRect, type FadeNow, type Slide } from './slideshowData';
import type { PhotoLook, SlideshowOptions } from './types';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface SlideSource {
  /** The photo (a photo slide), or the clip's frame now (a clip slide); null while it's loading. */
  img: CanvasImageSource | null;
  w: number;
  h: number;
  /** A clip slide: its part now and the clip's own seconds. */
  seg?: Exclude<Segment, { type: 'card' }>;
  t?: number;
}

/** A soft, dark copy of a picture filling the frame (behind a photo or film that doesn't fill it). */
function softFill(c: Ctx2D, W: number, H: number, img: CanvasImageSource, sw: number, sh: number, tiny: AnyCanvas) {
  const tctx = tiny.getContext('2d') as Ctx2D;
  const cover = Math.max(tiny.width / sw, tiny.height / sh);
  tctx.drawImage(img, (tiny.width - sw * cover) / 2, (tiny.height - sh * cover) / 2, sw * cover, sh * cover);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(tiny, 0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.fillRect(0, 0, W, H);
}

export function drawSlide(
  c: Ctx2D,
  W: number,
  H: number,
  slide: Slide,
  local: number,
  src: SlideSource | null,
  o: {
    look: HighlightSettings;
    logo?: HTMLImageElement | null;
    tiny: AnyCanvas;
    backdrop?: 'blur' | 'black' | 'team';
    /** The slideshow's color look, darker corners, the logo in the corner, where photo words go. */
    tone?: PhotoLook;
    vignette?: boolean;
    logoBug?: boolean;
    captionAt?: 'bottom' | 'top';
  }
) {
  c.save();
  c.globalAlpha = 1;
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  if (slide.kind === 'title') {
    drawCard(c as CanvasRenderingContext2D, W, H, { kind: 'intro', title: slide.item.title, sub: slide.item.sub }, o.look, o.logo);
  } else if (slide.kind === 'spot') {
    drawSpot(c, W, H, slide.item.label, o.look);
  } else if (slide.kind === 'photo') {
    if (src?.img && src.w && src.h) {
      const fill = fitsByFilling(slide.fit, src.w, src.h, W, H);
      const r = photoRect(src.w, src.h, W, H, fill, slide.motion, local / slide.seconds, slide.strength, slide.item.focus, { from: slide.item.frame, to: slide.item.frameEnd });
      if (r.w < W - 1 || r.h < H - 1) {
        if (o.backdrop === 'team') {
          c.fillStyle = o.look.primary || '#0f172a';
          c.fillRect(0, 0, W, H);
        } else if (o.backdrop !== 'black') softFill(c, W, H, src.img, src.w, src.h, o.tiny);
      }
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(src.img, r.x, r.y, r.w, r.h);
      tone(c, W, H, slide.item.look || o.tone || 'natural');
      if (o.vignette) vignette(c, W, H);
    }
    if (o.logoBug) logoBug(c, W, H, o.logo);
    if (slide.item.caption) {
      if (o.captionAt === 'top') topCaption(c, W, H, slide.item.caption, o.look);
      else drawSocialTitle(c, W, H, { title: slide.item.caption }, o.look, o.logo);
    }
  } else if (src?.seg) {
    drawHighlightFrame(c, W, H, {
      s: src.seg,
      t: src.t ?? 0,
      src: src.img,
      srcW: src.w || 16,
      srcH: src.h || 9,
      tiny: o.tiny,
      zoom: 0,
      followZoom: 1,
      titles: true,
      look: o.look,
      logo: o.logo,
      local: 0,
      starts: false,
      transition: 'cut',
    });
    tone(c, W, H, o.tone || 'natural');
    if (o.logoBug) logoBug(c, W, H, o.logo);
  }
  c.restore();
}

/** A spare canvas the size of the frame (pushes and soft wipes draw through it). */
let spare: AnyCanvas | null = null;
function spareCanvas(W: number, H: number): AnyCanvas {
  if (!spare || spare.width !== W || spare.height !== H) {
    spare = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  }
  return spare;
}

/** The fade over a frame: the last slide's last frame dissolving, wiping or pushing away, and a black / white veil. */
export function drawFade(c: Ctx2D, W: number, H: number, f: FadeNow, prev: AnyCanvas | null) {
  if (f.cross > 0.001 && prev) {
    c.save();
    c.globalAlpha = f.cross;
    c.drawImage(prev, 0, 0, W, H);
    c.restore();
  }
  if (f.move && prev && f.move.p < 0.999) {
    const p = f.move.p;
    const e = p * p * (3 - 2 * p);
    c.save();
    if (f.move.kind === 'push') {
      // The new slide comes in from the right, pushing the last one off to the left.
      const s = spareCanvas(W, H);
      const sx = s.getContext('2d') as Ctx2D;
      sx.globalCompositeOperation = 'copy';
      sx.drawImage(c.canvas as AnyCanvas, 0, 0, W, H);
      sx.globalCompositeOperation = 'source-over';
      c.drawImage(prev, -W * e, 0, W, H);
      c.drawImage(s, W * (1 - e), 0, W, H);
    } else if (f.move.kind === 'wipe') {
      // A soft edge sweeping left to right; the last slide still shows to its right.
      const edge = W * 0.08;
      const x = -edge + (W + edge * 2) * e;
      const s = spareCanvas(W, H);
      const sx = s.getContext('2d') as Ctx2D;
      sx.globalCompositeOperation = 'copy';
      sx.drawImage(prev, 0, 0, W, H);
      sx.globalCompositeOperation = 'destination-in';
      const g = sx.createLinearGradient(x - edge, 0, x + edge, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      sx.fillStyle = g;
      sx.fillRect(0, 0, W, H);
      sx.globalCompositeOperation = 'source-over';
      c.drawImage(s, 0, 0, W, H);
    } else {
      // Zoom through: the last slide grows and fades into the new one.
      const k = 1 + 0.4 * e;
      c.globalAlpha = 1 - e;
      c.drawImage(prev, (W - W * k) / 2, (H - H * k) / 2, W * k, H * k);
    }
    c.restore();
  }
  if (f.veil > 0.001) {
    c.save();
    c.fillStyle = f.color === 'white' ? `rgba(255,255,255,${f.veil})` : `rgba(0,0,0,${f.veil})`;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
}

/** A color look over what's drawn (blend modes every browser's canvas has, so the iPad's video matches). */
export function tone(c: Ctx2D, W: number, H: number, look: PhotoLook) {
  if (look === 'natural') return;
  c.save();
  const fill = (op: GlobalCompositeOperation, color: string, alpha = 1) => {
    c.globalCompositeOperation = op;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(0, 0, W, H);
  };
  if (look === 'bw') {
    fill('saturation', '#808080');
    fill('soft-light', '#808080', 0.35);
  } else if (look === 'warm') fill('soft-light', '#ff9a3c', 0.45);
  else if (look === 'cool') fill('soft-light', '#3c8cff', 0.4);
  else if (look === 'vintage') {
    fill('saturation', '#808080', 0.55);
    fill('soft-light', '#d9a066', 0.55);
    fill('screen', '#2a2018', 0.35);
  }
  c.restore();
}

/** Darker corners. */
export function vignette(c: Ctx2D, W: number, H: number) {
  c.save();
  const r = Math.hypot(W, H) / 2;
  const g = c.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();
}

/** The team logo small in the top right corner. */
export function logoBug(c: Ctx2D, W: number, H: number, logo?: HTMLImageElement | null) {
  if (!logo || !logo.naturalWidth) return;
  const size = Math.min(W, H) * 0.11;
  const k = size / Math.max(logo.naturalWidth, logo.naturalHeight);
  const w = logo.naturalWidth * k;
  const h = logo.naturalHeight * k;
  const m = Math.min(W, H) * 0.035;
  c.save();
  c.globalAlpha = 0.85;
  c.shadowColor = 'rgba(0,0,0,0.5)';
  c.shadowBlur = size * 0.12;
  c.drawImage(logo, W - m - w, m, w, h);
  c.restore();
}

/** Words on a photo at the top: a dark band with the team's color down its side. */
export function topCaption(c: Ctx2D, W: number, H: number, text: string, look: HighlightSettings) {
  c.save();
  let size = Math.round(Math.min(W, H) * 0.055);
  const font = (s: number) => `800 ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  c.font = font(size);
  while (size > 12 && c.measureText(text).width > W * 0.82) c.font = font((size -= 2));
  const tw = c.measureText(text).width;
  const pad = size * 0.6;
  const bar = Math.max(4, size * 0.18);
  const w = tw + pad * 2 + bar;
  const h = size * 1.7;
  const x = (W - w) / 2;
  const y = Math.min(W, H) * 0.06;
  c.fillStyle = 'rgba(15,23,42,0.74)';
  c.beginPath();
  c.roundRect?.(x, y, w, h, h * 0.18);
  if (!c.roundRect) c.rect(x, y, w, h);
  c.fill();
  c.fillStyle = look.accent || '#f2b705';
  c.fillRect(x, y, bar, h);
  c.fillStyle = '#f8fafc';
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillText(text, x + bar + pad, y + h / 2 + size * 0.04);
  c.restore();
}

/** A spot saved for a photo: a dashed frame with what goes there. */
export function drawSpot(c: Ctx2D, W: number, H: number, label: string | undefined, look: HighlightSettings) {
  c.save();
  c.fillStyle = '#1e293b';
  c.fillRect(0, 0, W, H);
  const m = Math.min(W, H) * 0.07;
  c.strokeStyle = '#94a3b8';
  c.lineWidth = Math.max(2, Math.min(W, H) * 0.008);
  c.setLineDash([c.lineWidth * 4, c.lineWidth * 3]);
  c.strokeRect(m, m, W - m * 2, H - m * 2);
  c.setLineDash([]);
  const r = Math.min(W, H) * 0.07;
  c.strokeStyle = look.accent || '#f2b705';
  c.lineWidth = r * 0.16;
  c.beginPath();
  c.arc(W / 2, H / 2 - r * 0.9, r, 0, Math.PI * 2);
  c.moveTo(W / 2 - r * 0.5, H / 2 - r * 0.9);
  c.lineTo(W / 2 + r * 0.5, H / 2 - r * 0.9);
  c.moveTo(W / 2, H / 2 - r * 1.4);
  c.lineTo(W / 2, H / 2 - r * 0.4);
  c.stroke();
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillStyle = '#e2e8f0';
  const big = Math.round(Math.min(W, H) * 0.055);
  c.font = `800 ${big}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  c.fillText('Photo goes here', W / 2, H / 2 + r * 0.5);
  if (label) {
    c.fillStyle = '#94a3b8';
    c.font = `600 ${Math.round(big * 0.75)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    c.fillText(label.slice(0, 60), W / 2, H / 2 + r * 0.5 + big * 1.4);
  }
  c.restore();
}

/** The slideshow's options drawSlide reads. */
export const slideLook = (o: Pick<SlideshowOptions, 'backdrop' | 'look' | 'vignette' | 'logoBug' | 'captionAt'>) => ({
  backdrop: o.backdrop,
  tone: o.look,
  vignette: o.vignette,
  logoBug: o.logoBug,
  captionAt: o.captionAt,
});
