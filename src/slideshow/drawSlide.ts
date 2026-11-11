// One frame of a slideshow: a photo (slowly moving, filling the frame or whole with a soft copy behind it), a title
// card, or a clip's film with its circles and title, then the fade over it (the last slide dissolving away, or a
// black / white veil). The in-app player and the MP4 draw with this, so they look the same.
import { drawCard } from '../highlights/graphics';
import type { Segment } from '../highlights/highlightData';
import type { HighlightSettings } from '../highlights/types';
import { drawHighlightFrame, drawSocialTitle } from '../highlights/socialVideo';
import { fitsByFilling, photoRect, type Slide } from './slideshowData';

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
  o: { look: HighlightSettings; logo?: HTMLImageElement | null; tiny: AnyCanvas }
) {
  c.save();
  c.globalAlpha = 1;
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  if (slide.kind === 'title') {
    drawCard(c as CanvasRenderingContext2D, W, H, { kind: 'intro', title: slide.item.title, sub: slide.item.sub }, o.look, o.logo);
  } else if (slide.kind === 'photo') {
    if (src?.img && src.w && src.h) {
      const fill = fitsByFilling(slide.fit, src.w, src.h, W, H);
      const r = photoRect(src.w, src.h, W, H, fill, slide.motion, local / slide.seconds);
      if (r.w < W - 1 || r.h < H - 1) softFill(c, W, H, src.img, src.w, src.h, o.tiny);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(src.img, r.x, r.y, r.w, r.h);
    }
    if (slide.item.caption) drawSocialTitle(c, W, H, { title: slide.item.caption }, o.look, o.logo);
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
  }
  c.restore();
}

/** The fade over a frame: the last slide's last frame dissolving away, and a black / white veil. */
export function drawFade(c: Ctx2D, W: number, H: number, f: { cross: number; veil: number; color: 'black' | 'white' }, prev: AnyCanvas | null) {
  if (f.cross > 0.001 && prev) {
    c.save();
    c.globalAlpha = f.cross;
    c.drawImage(prev, 0, 0, W, H);
    c.restore();
  }
  if (f.veil > 0.001) {
    c.save();
    c.fillStyle = f.color === 'white' ? `rgba(255,255,255,${f.veil})` : `rgba(0,0,0,${f.veil})`;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
}
