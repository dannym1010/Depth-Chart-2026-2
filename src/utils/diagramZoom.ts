/**
 * Zoom a saved play / formation picture (SVG data URL) onto the players and their lines, so the formation fills
 * the picture instead of a strip of the whole field. Anything that isn't an SVG data URL comes back unchanged.
 */
export function zoomDiagram(url: string | undefined, margin = 26): string | undefined {
  if (!url || !url.startsWith('data:image/svg+xml')) return url;
  const comma = url.indexOf(',');
  const head = url.slice(0, comma + 1);
  let svg: string;
  try {
    svg = decodeURIComponent(url.slice(comma + 1));
  } catch {
    return url;
  }
  const vb = svg.match(/viewBox='([\d.\s-]+)'/) || svg.match(/viewBox="([\d.\s-]+)"/);
  if (!vb) return url;
  const [, , W, H] = vb[1].trim().split(/\s+/).map(Number);
  if (!W || !H) return url;
  // Players are circles and small rects (labels); their lines are line elements.
  const xs: number[] = [];
  const ys: number[] = [];
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  for (const m of body.matchAll(/<circle[^>]*\scx=['"]([\d.-]+)['"][^>]*\scy=['"]([\d.-]+)['"][^>]*\sr=['"]([\d.]+)['"]/g)) {
    const [x, y, r] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (r > 40) continue;
    xs.push(x - r, x + r);
    ys.push(y - r, y + r);
  }
  for (const m of body.matchAll(/<rect[^>]*\sx=['"]([\d.-]+)['"][^>]*\sy=['"]([\d.-]+)['"][^>]*\swidth=['"]([\d.]+)['"][^>]*\sheight=['"]([\d.]+)['"]/g)) {
    const [x, y, w, h] = m.slice(1).map(Number);
    if (w > 80 || h > 80) continue; // the field, zones and boxes aren't players
    xs.push(x, x + w);
    ys.push(y, y + h);
  }
  // Coverage zones (ellipses) stay in the picture too.
  for (const m of body.matchAll(/<ellipse[^>]*\scx=['"]([\d.-]+)['"][^>]*\scy=['"]([\d.-]+)['"][^>]*\srx=['"]([\d.]+)['"][^>]*\sry=['"]([\d.]+)['"]/g)) {
    const [x, y, rx, ry] = m.slice(1).map(Number);
    xs.push(x - rx, x + rx);
    ys.push(y - ry, y + ry);
  }
  for (const m of body.matchAll(/<line[^>]*\sx1=['"]([\d.-]+)['"][^>]*\sy1=['"]([\d.-]+)['"][^>]*\sx2=['"]([\d.-]+)['"][^>]*\sy2=['"]([\d.-]+)['"]/g)) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    if (Math.abs(x2 - x1) > W * 0.6) continue; // field-wide lines (line of scrimmage etc.)
    xs.push(x1, x2);
    ys.push(y1, y2);
  }
  if (xs.length < 4) return url;
  let x0 = Math.max(0, Math.min(...xs) - margin);
  const x1 = Math.min(W, Math.max(...xs) + margin);
  let y0 = Math.max(0, Math.min(...ys) - margin);
  let y1 = Math.min(H, Math.max(...ys) + margin);
  // Not too thin: at least about half as tall as it is wide.
  if (y1 - y0 < (x1 - x0) / 2.2) {
    const need = (x1 - x0) / 2.2;
    const cy = (y0 + y1) / 2;
    y0 = Math.max(0, cy - need / 2);
    y1 = Math.min(H, y0 + need);
  }
  x0 = Math.max(0, x0);
  if (x1 - x0 > W * 0.92 && y1 - y0 > H * 0.92) return url; // already fills it
  const box = `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`;
  // The picture takes the zoomed shape, so the players fill it.
  const out = svg
    .replace(vb[0], vb[0].replace(vb[1], box))
    .replace(/(<svg[^>]*\swidth=)(['"])[\d.]+\2/, (_m, a: string, q: string) => `${a}${q}${(x1 - x0).toFixed(0)}${q}`)
    .replace(/(<svg[^>]*\sheight=)(['"])[\d.]+\2/, (_m, a: string, q: string) => `${a}${q}${(y1 - y0).toFixed(0)}${q}`);
  return head + encodeURIComponent(out);
}
