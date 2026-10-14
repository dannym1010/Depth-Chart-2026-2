// A play picture made easier to read on paper: cropped to the players and their lines (so the play prints
// bigger), on a white field with lighter yard markings, with thicker and darker lines. Screens are unchanged.

const SVG_PREFIX = /^data:image\/svg\+xml(;[^,]*)?,/;

/** The SVG text of a picture's data URL (undefined for anything else, e.g. a PNG). */
export function svgOfDataUrl(url?: string | null): string | undefined {
  if (!url || !SVG_PREFIX.test(url)) return undefined;
  const head = url.slice(0, url.indexOf(','));
  const body = url.slice(url.indexOf(',') + 1);
  try {
    if (/;base64/i.test(head)) {
      const bin = atob(body);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    // Lightly encoded pictures can carry a bare "%": take them as they are.
    return body.includes('<svg') ? body : undefined;
  }
}

// On-screen colors -> print colors (darker, so they hold up on paper and in black and white).
const LINE_COLORS: [string, string][] = [
  ['#2563eb', '#1d4ed8'], // pass
  ['#ea580c', '#c2410c'], // blitz / stunt
  ['#0f766e', '#0b5d56'], // coverage
  ['#15803d', '#166534'], // our defenders
];

const NUM = (s?: string) => (s === undefined ? NaN : parseFloat(s));

/** The area the players and their lines take up (everything after the line of scrimmage), in picture units. */
function contentBox(content: string) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number, rx = 0, ry = rx) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x - rx);
    maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry);
    maxY = Math.max(maxY, y + ry);
  };
  for (const tag of content.match(/<(rect|circle|ellipse|line|path|polygon|text)\b[^>]*>/g) || []) {
    const a = (name: string) => tag.match(new RegExp(`\\s${name}=['"]([^'"]*)['"]`))?.[1];
    if (tag.startsWith('<rect')) {
      const x = NUM(a('x'));
      const y = NUM(a('y'));
      add(x, y);
      add(x + NUM(a('width')), y + NUM(a('height')));
    } else if (tag.startsWith('<circle')) add(NUM(a('cx')), NUM(a('cy')), NUM(a('r')) || 0);
    else if (tag.startsWith('<ellipse')) add(NUM(a('cx')), NUM(a('cy')), NUM(a('rx')) || 0, NUM(a('ry')) || 0);
    else if (tag.startsWith('<line')) {
      add(NUM(a('x1')), NUM(a('y1')));
      add(NUM(a('x2')), NUM(a('y2')));
    } else if (tag.startsWith('<text')) add(NUM(a('x')), NUM(a('y')));
    else {
      const pts = a('d') || a('points') || '';
      const nums = (pts.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) add(nums[i], nums[i + 1]);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** The picture for print. Anything that isn't one of our SVG play pictures comes back as it was. */
export function printableDiagram(url?: string | null): string | null | undefined {
  const svg = svgOfDataUrl(url);
  if (!svg || !svg.includes('<svg')) return url;
  // The field is drawn first; the line of scrimmage (full width) comes right before the players and lines.
  const los = svg.search(/<line x1=['"]0['"][^>]*x2=['"]760['"][^>]*>/);
  const field = los > 0 ? svg.slice(0, los) : '';
  let rest = los > 0 ? svg.slice(los) : svg;
  let head = field
    .replace(/fill=(['"])#f0f0f0\1/g, "fill='#ffffff'")
    .replace(/stroke=(['"])#b4b4b4\1/g, "stroke='#d6d6d6'")
    .replace(/stroke=(['"])#c7c7c7\1/g, "stroke='#e6e6e6'");
  // Thicker lines (players' outlines too), darker colors.
  rest = rest.replace(/stroke-width=(['"])([\d.]+)\1/g, (_m, q, w) => `stroke-width=${q}${Math.round(Number(w) * 1.45 * 100) / 100}${q}`);
  for (const [from, to] of LINE_COLORS) rest = rest.split(from).join(to);
  // Crop to the play, with room around it; never narrower than the box between the hashes.
  const box = contentBox(rest);
  if (box && los > 0) {
    const pad = 34;
    let x = Math.max(0, box.minX - pad);
    let x2 = Math.min(760, box.maxX + pad);
    const y = Math.max(0, box.minY - pad);
    const y2 = Math.min(520, box.maxY + pad);
    if (x2 - x < 420) {
      const c = (x + x2) / 2;
      x = Math.max(0, Math.min(760 - 420, c - 210));
      x2 = x + 420;
    }
    head = head.replace(/viewBox=(['"])[^'"]*\1/, `viewBox='${x.toFixed(1)} ${y.toFixed(1)} ${(x2 - x).toFixed(1)} ${(y2 - y).toFixed(1)}'`);
    head = head.replace(/\swidth=(['"])760\1\s+height=(['"])520\2/, ` width='${Math.round(x2 - x)}' height='${Math.round(y2 - y)}'`);
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(head + rest)}`;
}
