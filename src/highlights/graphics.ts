// The pictures a reel shows over the film: title cards (intro, game chapters, a kid's season, the end), the title
// at the bottom of each highlight (four styles), the small score in a corner, and spotlights on a kid in a freeze
// frame. The in-app player draws them on a canvas over the video; the export saves the same drawing as PNG files
// (see-through where there's no graphic), so the reel looks the same everywhere.
import type { CardSpec, Overlay } from './highlightData';
import type { HighlightSettings, SpotStyle } from './types';

export const FONTS = ['Impact', 'Arial Black', 'Trebuchet MS', 'Georgia', 'Verdana'];

type Look = Pick<HighlightSettings, 'primary' | 'accent' | 'text' | 'font' | 'titleStyle' | 'logoCorner'>;

const fontStack = (f: string) => `"${f}", "Arial Black", Impact, sans-serif`;

/** Text shrunk until it fits the width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, font: string, maxW: number, weight = '900') {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${fontStack(font)}`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= Math.max(1, Math.round(s * 0.06));
  } while (s > 8);
  return s;
}

function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null | undefined, corner: Look['logoCorner'], scale = 0.11) {
  if (!logo || !logo.naturalWidth) return;
  const lh = Math.round(Math.min(w, h) * scale);
  const lw = Math.round((logo.naturalWidth / logo.naturalHeight) * lh);
  const m = Math.round(Math.min(w, h) * 0.04);
  const x = corner.endsWith('l') ? m : w - lw - m;
  const y = corner.startsWith('t') ? m : h - lh - m;
  ctx.drawImage(logo, x, y, lw, lh);
}

/** A full-frame title card. */
export function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, card: CardSpec, look: Look, logo?: HTMLImageElement | null) {
  const u = Math.min(w, h) / 1080;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, look.primary);
  g.addColorStop(1, shade(look.primary, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Yard lines in the background, faint.
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 6 * u;
  for (let x = -h; x < w; x += 160 * u) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.35, 0);
    ctx.stroke();
  }
  ctx.fillStyle = look.accent;
  ctx.fillRect(0, h * 0.5 + 70 * u, w, 10 * u);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = look.text;
  const big = card.kind === 'chapter' && /^No\. \d+$/.test(card.title) ? 200 : card.kind === 'stats' ? 90 : 120;
  fitText(ctx, card.title.toUpperCase(), big * u, look.font, w * 0.86);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18 * u;
  ctx.fillText(card.title.toUpperCase(), w / 2, h * 0.5 + (card.lines?.length ? -120 : 40) * u);
  ctx.shadowBlur = 0;
  if (card.sub) {
    ctx.fillStyle = look.accent;
    fitText(ctx, card.sub, 54 * u, look.font, w * 0.8, '700');
    ctx.fillText(card.sub, w / 2, h * 0.5 + (card.lines?.length ? -40 : 150) * u);
  }
  if (card.lines?.length) {
    ctx.fillStyle = look.text;
    card.lines.forEach((line, i) => {
      fitText(ctx, line, 58 * u, look.font, w * 0.8, '700');
      ctx.fillText(line, w / 2, h * 0.5 + (90 + i * 78) * u + 70 * u);
    });
  }
  drawLogo(ctx, w, h, logo, look.logoCorner, 0.16);
}

/** The title at the bottom (and the score in a corner) over the film; the rest stays see-through. */
export function drawLowerThird(ctx: CanvasRenderingContext2D, w: number, h: number, o: Overlay, look: Look, logo?: HTMLImageElement | null) {
  const u = Math.min(w, h) / 1080;
  const vertical = h > w;
  if (o.title) {
    const title = o.title.toUpperCase();
    const left = vertical ? w * 0.06 : w * 0.05;
    const base = vertical ? h * 0.8 : h * 0.86;
    const maxW = w * (vertical ? 0.88 : 0.6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const ts = fitText(ctx, title, 64 * u, look.font, maxW);
    const tw = ctx.measureText(title).width;
    const sub = o.sub || '';
    let ss = 0;
    let sw = 0;
    if (sub) {
      ss = fitText(ctx, sub, 38 * u, look.font, maxW, '700');
      sw = ctx.measureText(sub).width;
    }
    const pad = 22 * u;
    const boxW = Math.max(tw, sw) + pad * 2;
    const boxH = ts + (sub ? ss + 18 * u : 0) + pad * 1.4;
    const top = base - boxH;
    if (look.titleStyle === 'bar' || look.titleStyle === 'strip') {
      const full = look.titleStyle === 'strip';
      ctx.fillStyle = withAlpha(look.primary, 0.92);
      ctx.fillRect(full ? 0 : left, top, full ? w : boxW, boxH);
      ctx.fillStyle = look.accent;
      ctx.fillRect(full ? 0 : left, top - 8 * u, full ? w : boxW, 8 * u);
    } else if (look.titleStyle === 'box') {
      ctx.fillStyle = withAlpha(look.primary, 0.92);
      roundRect(ctx, left, top, boxW, boxH, 18 * u);
      ctx.fill();
      ctx.strokeStyle = look.accent;
      ctx.lineWidth = 5 * u;
      ctx.stroke();
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 14 * u;
    }
    ctx.fillStyle = look.text;
    ctx.font = `900 ${ts}px ${fontStack(look.font)}`;
    ctx.fillText(title, left + pad, top + pad * 0.7 + ts * 0.86);
    if (sub) {
      ctx.fillStyle = look.accent;
      ctx.font = `700 ${ss}px ${fontStack(look.font)}`;
      ctx.fillText(sub, left + pad, top + pad * 0.7 + ts + 14 * u + ss * 0.86);
    }
    ctx.shadowBlur = 0;
  }
  if (o.bug) {
    ctx.textAlign = 'right';
    const bs = fitText(ctx, o.bug, 36 * u, look.font, w * 0.4, '800');
    const bw = ctx.measureText(o.bug).width + 32 * u;
    const x = w - 36 * u;
    const y = 36 * u;
    ctx.fillStyle = withAlpha('#000000', 0.6);
    roundRect(ctx, x - bw, y, bw, bs + 22 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(o.bug, x - 16 * u, y + 11 * u + bs * 0.86);
  }
  if (logo && !o.bug) drawLogo(ctx, w, h, logo, look.logoCorner, 0.09);
}

/** A spotlight on a kid (x, y: 0..1 of the picture): a ring, an arrow, a glow, or a name tag. */
export function drawSpot(ctx: CanvasRenderingContext2D, w: number, h: number, spot: { x: number; y: number; style: SpotStyle; label?: string }, look: Look) {
  const u = Math.min(w, h) / 1080;
  const x = spot.x * w;
  const y = spot.y * h;
  const r = 70 * u;
  ctx.save();
  if (spot.style === 'glow') {
    // Darken everything but a circle around him.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = look.accent;
    ctx.lineWidth = 6 * u;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (spot.style === 'arrow') {
    ctx.fillStyle = look.accent;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4 * u;
    const tip = y - r * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, tip);
    ctx.lineTo(x - 40 * u, tip - 60 * u);
    ctx.lineTo(x - 15 * u, tip - 60 * u);
    ctx.lineTo(x - 15 * u, tip - 150 * u);
    ctx.lineTo(x + 15 * u, tip - 150 * u);
    ctx.lineTo(x + 15 * u, tip - 60 * u);
    ctx.lineTo(x + 40 * u, tip - 60 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Ring (and the tag's ring): an ellipse on the ground around his feet and up his body.
    ctx.strokeStyle = look.accent;
    ctx.lineWidth = 8 * u;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10 * u;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (spot.style === 'tag' && spot.label) {
    const s = fitText(ctx, spot.label, 40 * u, look.font, w * 0.4, '800');
    const tw = ctx.measureText(spot.label).width + 28 * u;
    const ty = y - r * 1.25 - 30 * u - s;
    ctx.fillStyle = withAlpha(look.primary, 0.95);
    roundRect(ctx, x - tw / 2, ty, tw, s + 20 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = look.text;
    ctx.textAlign = 'center';
    ctx.fillText(spot.label, x, ty + 10 * u + s * 0.86);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const hex = (c: string) => {
  const m = c.replace('#', '');
  const full = m.length === 3 ? m.split('').map((x) => x + x).join('') : m.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
};
const withAlpha = (c: string, a: number) => `rgba(${hex(c).join(',')},${a})`;
const shade = (c: string, amt: number) => `rgb(${hex(c).map((v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)).join(',')})`;

/** A logo picture from its data URL (null while none). */
export function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A drawing as a PNG file. */
export function canvasPng(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/png'));
}

/** One frame of a video file at a moment, as a PNG the size of the reel (the frame fitted inside, black bars). */
export async function frameGrab(file: Blob, at: number, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('The film took too long to open.')), 20000);
      v.onloadeddata = () => {
        window.clearTimeout(t);
        resolve();
      };
      v.onerror = () => {
        window.clearTimeout(t);
        reject(new Error("This browser can't open that clip."));
      };
    });
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      v.addEventListener('seeked', done, { once: true });
      v.currentTime = Math.min(Math.max(0, at), Math.max(0, (v.duration || at) - 0.05));
      window.setTimeout(done, 8000);
    });
    return await canvasPng(w, h, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      const s = Math.min(w / v.videoWidth, h / v.videoHeight);
      const dw = v.videoWidth * s;
      const dh = v.videoHeight * s;
      ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
