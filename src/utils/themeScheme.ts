import type { ThemeScheme } from '../components/ThemeGalleryModal';

/**
 * Turns a visual scheme into live CSS custom properties.
 *
 * Tailwind v4 compiles every colour utility to `var(--color-<hue>-<shade>)`, so
 * re-pointing those variables on <html> restyles the whole app at once without
 * touching the thousands of utility classes in the components.
 *
 * Only the chrome hues are remapped. Red, emerald and amber carry meaning
 * (danger, success, warning) and blue is the defensive-unit colour, so those
 * scales are left alone no matter which scheme is active.
 */

const PRIMARY_HUES = ['indigo', 'violet', 'purple', 'fuchsia'] as const;
const SECONDARY_HUES = ['cyan', 'sky', 'teal'] as const;
const NEUTRAL_HUES = ['slate', 'zinc', 'gray', 'neutral'] as const;
const RAMP_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Blends in gamma-corrected space so mid shades keep their chroma instead of going muddy. */
function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const channel = (a: number, b: number) =>
    Math.sqrt((1 - amount) * (a / 255) ** 2 + amount * (b / 255) ** 2) * 255;
  return {
    r: channel(from.r, to.r),
    g: channel(from.g, to.g),
    b: channel(from.b, to.b),
  };
}

/**
 * Straight sRGB blend. Gamma mixing exaggerates every step away from a dark
 * colour, which turns a navy card ramp into flat grey, so the neutral surfaces
 * use this instead and keep their hue.
 */
function lerp(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** How far each shade sits from the base colour, which anchors at 600. */
const ACCENT_RAMP: Record<number, { toward: Rgb; amount: number }> = {
  50: { toward: WHITE, amount: 0.94 },
  100: { toward: WHITE, amount: 0.87 },
  200: { toward: WHITE, amount: 0.74 },
  300: { toward: WHITE, amount: 0.57 },
  400: { toward: WHITE, amount: 0.34 },
  500: { toward: WHITE, amount: 0.15 },
  600: { toward: WHITE, amount: 0 },
  700: { toward: BLACK, amount: 0.16 },
  800: { toward: BLACK, amount: 0.32 },
  900: { toward: BLACK, amount: 0.48 },
  950: { toward: BLACK, amount: 0.68 },
};

function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Darkest the 600 anchor may be allowed to sit, so `text-white` stays legible on it. */
const SOLID_MAX_LUMINANCE = 0.25;

function accentRamp(baseHex: string): Record<number, string> {
  const base = hexToRgb(baseHex);

  // Bright signature colours (volt lime, polar ice) are unusable as a solid
  // button fill because the markup pairs them with white text. Those schemes
  // keep their glow in the 50-400 range and darken from 500 down, so badges and
  // icons stay neon while filled controls stay readable.
  let anchor = base;
  if (luminance(base) > SOLID_MAX_LUMINANCE) {
    let amount = 0.05;
    while (amount < 0.95 && luminance(mix(base, BLACK, amount)) > SOLID_MAX_LUMINANCE) {
      amount += 0.05;
    }
    anchor = mix(base, BLACK, amount);
  }

  const out: Record<number, string> = {};
  for (const shade of RAMP_SHADES) {
    const step = ACCENT_RAMP[shade];
    if (shade < 500) {
      out[shade] = rgbToHex(step.amount === 0 ? base : mix(base, step.toward, step.amount));
    } else if (shade === 500) {
      out[shade] = rgbToHex(mix(anchor, base, 0.45));
    } else if (shade === 600) {
      out[shade] = rgbToHex(anchor);
    } else {
      out[shade] = rgbToHex(mix(anchor, BLACK, step.amount));
    }
  }
  return out;
}

/**
 * The dark neutral ramp is anchored at both ends: 950 is the page canvas and
 * 900 the card surface, with the half steps the components use (850/750/650)
 * walking steadily lighter toward the borders.
 */
function darkNeutralRamp(canvasHex: string, surfaceHex: string): Record<string, string> {
  const canvas = hexToRgb(canvasHex);
  const surface = hexToRgb(surfaceHex);
  const lift = (amount: number) => rgbToHex(lerp(surface, WHITE, amount));
  return {
    '950': rgbToHex(canvas),
    '900': rgbToHex(surface),
    '850': lift(0.04),
    '800': lift(0.08),
    '750': lift(0.13),
    '700': lift(0.19),
    '650': lift(0.26),
  };
  // 600 and lighter are deliberately left on Tailwind's defaults. Those shades
  // are used for text and icons as often as for fills, and re-pointing them at
  // a lifted surface colour would put mid-dark labels on a dark card.
}

/** Every property this module can set, so a scheme change starts from a clean slate. */
function managedProperties(): string[] {
  const props: string[] = [
    '--surface-canvas',
    '--surface-raised',
    '--surface-sunken',
    '--surface-hover',
    '--surface-line',
    '--surface-line-strong',
  ];
  for (const hue of [...PRIMARY_HUES, ...SECONDARY_HUES]) {
    for (const shade of RAMP_SHADES) props.push(`--color-${hue}-${shade}`);
    props.push(`--color-${hue}-450`, `--color-${hue}-550`, `--color-${hue}-650`, `--color-${hue}-850`);
  }
  for (const hue of NEUTRAL_HUES) {
    for (const shade of ['950', '900', '850', '800', '750', '700', '650', '600']) {
      props.push(`--color-${hue}-${shade}`);
    }
  }
  return props;
}

export function applyThemeScheme(scheme: ThemeScheme | undefined, mode: 'dark' | 'light'): void {
  const root = document.documentElement;
  for (const prop of managedProperties()) root.style.removeProperty(prop);
  if (!scheme) return;

  const { primary, secondary, canvas, surface } = scheme.palette;

  const primaryRamp = accentRamp(primary);
  for (const hue of PRIMARY_HUES) {
    for (const shade of RAMP_SHADES) {
      root.style.setProperty(`--color-${hue}-${shade}`, primaryRamp[shade]);
    }
    // Half steps the components reference that Tailwind does not ship.
    root.style.setProperty(`--color-${hue}-450`, primaryRamp[400]);
    root.style.setProperty(`--color-${hue}-550`, primaryRamp[500]);
    root.style.setProperty(`--color-${hue}-650`, primaryRamp[600]);
    root.style.setProperty(`--color-${hue}-850`, primaryRamp[800]);
  }

  const secondaryRamp = accentRamp(secondary);
  for (const hue of SECONDARY_HUES) {
    for (const shade of RAMP_SHADES) {
      root.style.setProperty(`--color-${hue}-${shade}`, secondaryRamp[shade]);
    }
    root.style.setProperty(`--color-${hue}-450`, secondaryRamp[400]);
    root.style.setProperty(`--color-${hue}-550`, secondaryRamp[500]);
    root.style.setProperty(`--color-${hue}-650`, secondaryRamp[600]);
    root.style.setProperty(`--color-${hue}-850`, secondaryRamp[800]);
  }

  // A scheme only owns the canvas while the display mode it was designed for is
  // active. Forcing a dark scheme's near-black canvas onto light mode (or the
  // reverse) would wreck legibility, so in that case the accents travel alone.
  if (scheme.mode !== mode) return;

  if (mode === 'dark') {
    const ramp = darkNeutralRamp(canvas, surface);
    for (const hue of NEUTRAL_HUES) {
      for (const [shade, value] of Object.entries(ramp)) {
        root.style.setProperty(`--color-${hue}-${shade}`, value);
      }
    }
  } else {
    const canvasRgb = hexToRgb(canvas);
    const surfaceRgb = hexToRgb(surface);
    root.style.setProperty('--surface-canvas', rgbToHex(canvasRgb));
    root.style.setProperty('--surface-raised', rgbToHex(surfaceRgb));
    root.style.setProperty('--surface-sunken', rgbToHex(lerp(canvasRgb, surfaceRgb, 0.5)));
    root.style.setProperty('--surface-hover', rgbToHex(lerp(canvasRgb, BLACK, 0.05)));
    root.style.setProperty('--surface-line', rgbToHex(lerp(canvasRgb, BLACK, 0.13)));
    root.style.setProperty('--surface-line-strong', rgbToHex(lerp(canvasRgb, BLACK, 0.26)));
  }
}
