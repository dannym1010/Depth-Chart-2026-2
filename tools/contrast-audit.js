/**
 * Text contrast auditor. Paste into the browser console (or run via devtools)
 * while any screen is open to list every unreadable label on the page.
 *
 *   __contrastAudit()            // failures on the current screen
 *   __contrastAudit({ min: 3 })  // only the severe ones
 *
 * Not bundled with the app; this is a development tool.
 */
(function () {
  // Tailwind v4 emits oklch(), which no string parser handles reliably. Painting
  // the colour onto a 1x1 canvas and reading the pixel back gets true sRGB bytes
  // for any colour syntax the browser itself understands.
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const resolved = new Map();

  function toRgba(color) {
    if (!color || color === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (resolved.has(color)) return resolved.get(color);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const out = { r, g, b, a: a / 255 };
    resolved.set(color, out);
    return out;
  }

  function over(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const blend = (f, b) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
    return { r: blend(fg.r, bg.r), g: blend(fg.g, bg.g), b: blend(fg.b, bg.b), a };
  }

  function luminance({ r, g, b }) {
    const ch = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  }

  function ratio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Composites every painted ancestor layer down to an opaque colour. */
  function effectiveBackground(el) {
    let acc = { r: 0, g: 0, b: 0, a: 0 };
    let gradient = false;
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') gradient = true;
      const layer = toRgba(cs.backgroundColor);
      if (layer.a > 0) {
        acc = over(acc, layer);
        if (acc.a >= 0.999) break;
      }
    }
    if (acc.a < 0.999) acc = over(acc, { r: 255, g: 255, b: 255, a: 1 });
    return { color: acc, gradient };
  }

  function describe(el) {
    const cls = (el.className || '').toString().trim().split(/\s+/).slice(0, 6).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }

  window.__contrastAudit = function (opts) {
    const min = (opts && opts.min) || 4.5;
    const failures = [];

    document.querySelectorAll('*').forEach((el) => {
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      if (!text) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.15) return;

      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      // WCAG large text: 24px, or 18.66px when bold.
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const threshold = large ? Math.min(min, 3) : min;

      const fg = toRgba(cs.color);
      if (fg.a < 0.1) return;
      const bg = effectiveBackground(el);
      const contrast = ratio(over(fg, bg.color), bg.color);
      if (contrast >= threshold) return;

      failures.push({
        ratio: Number(contrast.toFixed(2)),
        needs: threshold,
        text: text.slice(0, 40),
        color: cs.color,
        background: `rgb(${Math.round(bg.color.r)}, ${Math.round(bg.color.g)}, ${Math.round(bg.color.b)})`,
        gradient: bg.gradient,
        el: describe(el),
      });
    });

    failures.sort((a, b) => a.ratio - b.ratio);
    return { total: failures.length, failures };
  };

  return window.__contrastAudit();
})();
