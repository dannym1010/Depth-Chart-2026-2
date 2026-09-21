import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Palette,
  Check,
  Zap,
  Shield,
  Watch,
  Sun,
  Moon,
  Filter,
} from 'lucide-react';

export interface ThemeScheme {
  id: string;
  name: string;
  subtitle: string;
  vibe: string;
  category: 'Modern Pro' | 'Championship' | 'Sports Tech' | 'Tactical' | 'Vintage Heritage' | 'Executive';
  mode: 'dark' | 'light';
  bgGradient: string;
  cardBg: string;
  cardBorder: string;
  starterBadge: {
    bg: string;
    text: string;
    border: string;
    label: string;
  };
  backupBadge: {
    bg: string;
    text: string;
    border: string;
    label: string;
  };
  reserveBadge: {
    bg: string;
    text: string;
    border: string;
    label: string;
  };
  launchpadCard: {
    gradient: string;
    border: string;
    iconBg: string;
    iconText: string;
    titleColor: string;
    badgeBg: string;
    badgeText: string;
  };
  wristband: {
    headerBg: string;
    headerText: string;
    leftRowBg: string;
    rightRowBg: string;
    tagBg: string;
  };
  swatches: { name: string; hex: string; desc: string }[];
  sidelineAdvantage: string;
  /**
   * The four colours that actually drive the running app. `swatches` above is
   * showcase copy and its ordering differs per scheme, so applying a theme
   * reads this instead. Light-mode canvases are pitched a little below their
   * showcase swatch to match the softened light theme.
   */
  palette: {
    canvas: string;
    surface: string;
    primary: string;
    secondary: string;
  };
}

export const THEME_SCHEMES: ThemeScheme[] = [
  // ==========================================
  // 6 DARK MODERN PROFESSIONAL SCHEMES
  // ==========================================
  {
    id: 'electric_volt',
    name: 'Midnight Gridiron & Electric Volt',
    subtitle: 'Nike Elite & Modern Oregon Athletic Style',
    category: 'Modern Pro',
    mode: 'dark',
    vibe: 'High-velocity athletic contrast engineered with smoked zinc surfaces, laser volt starters, and cyan telemetry.',
    bgGradient: 'from-slate-950 via-zinc-950 to-emerald-950/40',
    cardBg: 'bg-zinc-900/95',
    cardBorder: 'border-lime-500/40 hover:border-lime-400',
    starterBadge: {
      bg: 'bg-lime-400 text-black',
      border: 'border-lime-300',
      text: 'text-black font-black',
      label: 'STARTER • VOLT',
    },
    backupBadge: {
      bg: 'bg-cyan-500/20 text-cyan-300',
      border: 'border-cyan-400/40',
      text: 'text-cyan-300',
      label: 'GOLD • CYAN',
    },
    reserveBadge: {
      bg: 'bg-zinc-800 text-zinc-300',
      border: 'border-zinc-700',
      text: 'text-zinc-300',
      label: 'BLUE • RESERVE',
    },
    launchpadCard: {
      gradient: 'from-zinc-900 via-zinc-900 to-lime-950/40',
      border: 'border-lime-500/50 hover:border-lime-400',
      iconBg: 'bg-lime-400/20 border-lime-400/40',
      iconText: 'text-lime-400',
      titleColor: 'text-white group-hover:text-lime-300',
      badgeBg: 'bg-lime-400/20',
      badgeText: 'text-lime-300 border-lime-400/30',
    },
    wristband: {
      headerBg: 'bg-lime-400 text-black',
      headerText: 'text-black font-black',
      leftRowBg: 'bg-lime-950/40 border-lime-500/40',
      rightRowBg: 'bg-cyan-950/40 border-cyan-500/40',
      tagBg: 'bg-lime-400 text-black',
    },
    swatches: [
      { name: 'Carbon Jet', hex: '#0B0F17', desc: 'Base canvas' },
      { name: 'Volt Neon', hex: '#CCFF00', desc: 'Starters & key calls' },
      { name: 'Electric Cyan', hex: '#06B6D4', desc: 'Gold tier & motions' },
      { name: 'Smoked Zinc', hex: '#27272A', desc: 'Card background' },
    ],
    palette: { canvas: '#0B0F17', surface: '#27272A', primary: '#CCFF00', secondary: '#06B6D4' },
    sidelineAdvantage: 'High-luminance volt cuts through midday sun glare and bright stadium lights instantly.',
  },
  {
    id: 'championship_gold',
    name: 'Carbon Stealth & Championship Gold',
    subtitle: 'Vegas Nights & Black-and-Gold Dynasty',
    category: 'Championship',
    mode: 'dark',
    vibe: 'Authoritative collegiate championship presence with deep obsidian charcoal, rich metallic amber, and brushed platinum.',
    bgGradient: 'from-zinc-950 via-neutral-950 to-amber-950/30',
    cardBg: 'bg-neutral-900/95',
    cardBorder: 'border-amber-500/40 hover:border-amber-400',
    starterBadge: {
      bg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black',
      border: 'border-amber-300',
      text: 'text-black font-black',
      label: 'STARTER • GOLD',
    },
    backupBadge: {
      bg: 'bg-neutral-800 text-amber-300',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      label: 'GOLD • SILVER/GOLD',
    },
    reserveBadge: {
      bg: 'bg-neutral-850 text-neutral-400',
      border: 'border-neutral-700',
      text: 'text-neutral-300',
      label: 'BLUE • RESERVE',
    },
    launchpadCard: {
      gradient: 'from-neutral-900 via-neutral-900 to-amber-950/40',
      border: 'border-amber-500/50 hover:border-amber-400',
      iconBg: 'bg-amber-400/20 border-amber-400/40',
      iconText: 'text-amber-400',
      titleColor: 'text-white group-hover:text-amber-300',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300 border-amber-500/30',
    },
    wristband: {
      headerBg: 'bg-amber-400 text-black',
      headerText: 'text-black font-black',
      leftRowBg: 'bg-amber-950/40 border-amber-500/40',
      rightRowBg: 'bg-neutral-900 border-neutral-700',
      tagBg: 'bg-amber-400 text-black',
    },
    swatches: [
      { name: 'Obsidian Jet', hex: '#09090B', desc: 'Background dark' },
      { name: 'Aztec Gold', hex: '#F59E0B', desc: 'Primary varsity accents' },
      { name: 'Ice Silver', hex: '#E2E8F0', desc: 'Text & borders' },
      { name: 'Bronze Shadow', hex: '#78350F', desc: 'Depth layers' },
    ],
    palette: { canvas: '#09090B', surface: '#1C1917', primary: '#F59E0B', secondary: '#94A3B8' },
    sidelineAdvantage: 'High contrast with deep gold accents gives playbooks and depth charts an unmistakable varsity championship identity.',
  },
  {
    id: 'cyber_cobalt',
    name: 'Cyber Cobalt & Coral Rush',
    subtitle: 'Hudl Pro & Next-Gen Sports Analytics',
    category: 'Sports Tech',
    mode: 'dark',
    vibe: 'Crisp sports analytics interface with instant optical separation between offensive formations and defensive blitz packages.',
    bgGradient: 'from-slate-950 via-slate-900 to-indigo-950/40',
    cardBg: 'bg-slate-900/95',
    cardBorder: 'border-indigo-500/40 hover:border-indigo-400',
    starterBadge: {
      bg: 'bg-indigo-600 text-white',
      border: 'border-indigo-400',
      text: 'text-white font-black',
      label: 'STARTER • COBALT',
    },
    backupBadge: {
      bg: 'bg-rose-500/20 text-rose-300',
      border: 'border-rose-400/40',
      text: 'text-rose-300',
      label: 'GOLD • CORAL',
    },
    reserveBadge: {
      bg: 'bg-slate-800 text-slate-300',
      border: 'border-slate-750',
      text: 'text-slate-300',
      label: 'BLUE • RESERVE',
    },
    launchpadCard: {
      gradient: 'from-slate-900 via-slate-900 to-indigo-950/50',
      border: 'border-indigo-500/50 hover:border-indigo-400',
      iconBg: 'bg-indigo-500/20 border-indigo-500/40',
      iconText: 'text-indigo-400',
      titleColor: 'text-white group-hover:text-indigo-300',
      badgeBg: 'bg-indigo-500/20',
      badgeText: 'text-indigo-300 border-indigo-500/30',
    },
    wristband: {
      headerBg: 'bg-indigo-600 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-indigo-950/40 border-indigo-500/40',
      rightRowBg: 'bg-rose-950/40 border-rose-500/40',
      tagBg: 'bg-rose-500 text-white',
    },
    swatches: [
      { name: 'Space Navy', hex: '#0A0F24', desc: 'Main backdrop' },
      { name: 'Hyper Cobalt', hex: '#3B82F6', desc: 'Offense & starters' },
      { name: 'Coral Rush', hex: '#F43F5E', desc: 'Blitz & warnings' },
      { name: 'Deep Slate', hex: '#1E293B', desc: 'Card container' },
    ],
    palette: { canvas: '#0A0F24', surface: '#1E293B', primary: '#3B82F6', secondary: '#F43F5E' },
    sidelineAdvantage: 'Instant cognitive separation between Offense (Cobalt) and Defense/Substitutions (Coral).',
  },
  {
    id: 'stealth_olive',
    name: 'Stealth Olive & Tactical Desert',
    subtitle: 'Special Ops & Service Academy Discipline',
    category: 'Tactical',
    mode: 'dark',
    vibe: 'Rugged, disciplined, matte field equipment aesthetic with safety orange alerts and tactical olive accents.',
    bgGradient: 'from-stone-950 via-zinc-950 to-emerald-950/30',
    cardBg: 'bg-zinc-900/95',
    cardBorder: 'border-orange-500/40 hover:border-orange-400',
    starterBadge: {
      bg: 'bg-orange-500 text-white',
      border: 'border-orange-400',
      text: 'text-white font-black',
      label: 'STARTER • BLAZE',
    },
    backupBadge: {
      bg: 'bg-lime-950/60 text-lime-300',
      border: 'border-lime-500/40',
      text: 'text-lime-300',
      label: 'GOLD • OLIVE',
    },
    reserveBadge: {
      bg: 'bg-stone-850 text-stone-300',
      border: 'border-stone-700',
      text: 'text-stone-300',
      label: 'BLUE • DESERT',
    },
    launchpadCard: {
      gradient: 'from-zinc-900 via-zinc-900 to-orange-950/30',
      border: 'border-orange-500/50 hover:border-orange-400',
      iconBg: 'bg-orange-500/20 border-orange-500/40',
      iconText: 'text-orange-400',
      titleColor: 'text-white group-hover:text-orange-300',
      badgeBg: 'bg-orange-500/20',
      badgeText: 'text-orange-300 border-orange-500/30',
    },
    wristband: {
      headerBg: 'bg-orange-500 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-orange-950/40 border-orange-500/40',
      rightRowBg: 'bg-lime-950/40 border-lime-500/40',
      tagBg: 'bg-orange-500 text-white',
    },
    swatches: [
      { name: 'Gunmetal Stone', hex: '#1C1917', desc: 'Tactical base' },
      { name: 'Safety Blaze', hex: '#F97316', desc: 'Command priority' },
      { name: 'Field Olive', hex: '#65A30D', desc: 'Sub-packages & rotations' },
      { name: 'Desert Sand', hex: '#D6D3D1', desc: 'Data & metrics' },
    ],
    palette: { canvas: '#1C1917', surface: '#292524', primary: '#F97316', secondary: '#65A30D' },
    sidelineAdvantage: 'Extremely easy on coach eyes for evening practices, film breakdown, and low-light sidelines.',
  },
  {
    id: 'heritage_crimson',
    name: 'Heritage Crimson & Antique Bone',
    subtitle: 'Classic NCAA Blueblood & Traditional Gridiron',
    category: 'Vintage Heritage',
    mode: 'dark',
    vibe: 'Timeless powerhouse aesthetic with rich burgundy, warm bone off-white, and antique gold trim.',
    bgGradient: 'from-slate-950 via-neutral-950 to-rose-950/30',
    cardBg: 'bg-neutral-900/95',
    cardBorder: 'border-rose-500/40 hover:border-rose-400',
    starterBadge: {
      bg: 'bg-rose-700 text-white',
      border: 'border-rose-500',
      text: 'text-white font-black',
      label: 'STARTER • CRIMSON',
    },
    backupBadge: {
      bg: 'bg-amber-950/50 text-amber-200',
      border: 'border-amber-500/40',
      text: 'text-amber-200',
      label: 'GOLD • ATHLETIC GOLD',
    },
    reserveBadge: {
      bg: 'bg-neutral-800 text-stone-300',
      border: 'border-neutral-700',
      text: 'text-stone-300',
      label: 'BLUE • BONE',
    },
    launchpadCard: {
      gradient: 'from-neutral-900 via-neutral-900 to-rose-950/40',
      border: 'border-rose-500/50 hover:border-rose-400',
      iconBg: 'bg-rose-500/20 border-rose-500/40',
      iconText: 'text-rose-400',
      titleColor: 'text-white group-hover:text-rose-300',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-300 border-rose-500/30',
    },
    wristband: {
      headerBg: 'bg-rose-700 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-rose-950/40 border-rose-500/40',
      rightRowBg: 'bg-amber-950/40 border-amber-500/40',
      tagBg: 'bg-rose-700 text-white',
    },
    swatches: [
      { name: 'Heritage Burgundy', hex: '#881337', desc: 'Varsity identity' },
      { name: 'Warm Bone', hex: '#FAF5EE', desc: 'Ultra-clean text' },
      { name: 'Varsity Gold', hex: '#D97706', desc: 'Highlights & badges' },
      { name: 'Obsidian Neutral', hex: '#171717', desc: 'Card container' },
    ],
    palette: { canvas: '#141414', surface: '#262626', primary: '#9F1239', secondary: '#D97706' },
    sidelineAdvantage: 'Classic timeless varsity appeal with maximum warmth and zero digital eye strain.',
  },
  {
    id: 'apex_titanium',
    name: 'Apex Titanium & Polar Ice',
    subtitle: 'Cold-Weather Gridiron & Minimalist Slate',
    category: 'Modern Pro',
    mode: 'dark',
    vibe: 'Sleek, futuristic cold-stadium aesthetic pairing deep titanium slate with crystalline ice cyan and frosted platinum.',
    bgGradient: 'from-slate-950 via-slate-900 to-sky-950/40',
    cardBg: 'bg-slate-900/95',
    cardBorder: 'border-sky-400/40 hover:border-sky-300',
    starterBadge: {
      bg: 'bg-sky-400 text-slate-950',
      border: 'border-sky-300',
      text: 'text-slate-950 font-black',
      label: 'STARTER • POLAR',
    },
    backupBadge: {
      bg: 'bg-slate-800 text-sky-200',
      border: 'border-sky-500/30',
      text: 'text-sky-200',
      label: 'GOLD • TITANIUM',
    },
    reserveBadge: {
      bg: 'bg-slate-850 text-slate-400',
      border: 'border-slate-700',
      text: 'text-slate-400',
      label: 'BLUE • FROST',
    },
    launchpadCard: {
      gradient: 'from-slate-900 via-slate-900 to-sky-950/40',
      border: 'border-sky-400/40 hover:border-sky-300',
      iconBg: 'bg-sky-400/20 border-sky-400/40',
      iconText: 'text-sky-300',
      titleColor: 'text-white group-hover:text-sky-300',
      badgeBg: 'bg-sky-500/20',
      badgeText: 'text-sky-300 border-sky-400/30',
    },
    wristband: {
      headerBg: 'bg-sky-400 text-slate-950',
      headerText: 'text-slate-950 font-black',
      leftRowBg: 'bg-sky-950/40 border-sky-400/30',
      rightRowBg: 'bg-slate-800 border-slate-700',
      tagBg: 'bg-sky-400 text-slate-950',
    },
    swatches: [
      { name: 'Deep Titanium', hex: '#0F172A', desc: 'Slate dark canvas' },
      { name: 'Polar Ice', hex: '#38BDF8', desc: 'Starters & key tags' },
      { name: 'Platinum Mist', hex: '#E0F2FE', desc: 'Crisp accents' },
      { name: 'Shadow Steel', hex: '#334155', desc: 'Structural borders' },
    ],
    palette: { canvas: '#0F172A', surface: '#1E293B', primary: '#38BDF8', secondary: '#94A3B8' },
    sidelineAdvantage: 'Ultra-clean, modern high-contrast blue spectrum offers razor-sharp visibility on OLED and tablet displays.',
  },

  // ==========================================
  // 6 LIGHT MODERN PROFESSIONAL SCHEMES
  // ==========================================
  {
    id: 'daylight_executive',
    name: 'Daylight Stadium & Modern Executive',
    subtitle: 'High-Luminance Contrast & Daylight Field Clarity',
    category: 'Executive',
    mode: 'light',
    vibe: 'Ultra-crisp, glare-resistant daylight interface with rich indigo accents, sunburst gold, and pure white surfaces.',
    bgGradient: 'from-slate-100 via-slate-50 to-indigo-50/50',
    cardBg: 'bg-white',
    cardBorder: 'border-slate-300 hover:border-indigo-500',
    starterBadge: {
      bg: 'bg-indigo-600 text-white',
      border: 'border-indigo-500',
      text: 'text-white font-black',
      label: 'STARTER • INDIGO',
    },
    backupBadge: {
      bg: 'bg-amber-100 text-amber-900',
      border: 'border-amber-300',
      text: 'text-amber-900 font-bold',
      label: 'ROTATION • GOLD',
    },
    reserveBadge: {
      bg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-300',
      text: 'text-slate-700',
      label: 'BLUE • RESERVE',
    },
    launchpadCard: {
      gradient: 'from-white via-slate-50 to-indigo-50/30',
      border: 'border-slate-300 hover:border-indigo-400',
      iconBg: 'bg-indigo-50 border-indigo-200',
      iconText: 'text-indigo-600',
      titleColor: 'text-slate-900 group-hover:text-indigo-600',
      badgeBg: 'bg-indigo-100',
      badgeText: 'text-indigo-700 border-indigo-200',
    },
    wristband: {
      headerBg: 'bg-indigo-600 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-indigo-50 border-indigo-200',
      rightRowBg: 'bg-amber-50 border-amber-200',
      tagBg: 'bg-indigo-600 text-white',
    },
    swatches: [
      { name: 'Daylight Field', hex: '#F8FAFC', desc: 'Base canvas' },
      { name: 'Executive Indigo', hex: '#4F46E5', desc: 'Starters & key calls' },
      { name: 'Stadium Sun Gold', hex: '#F59E0B', desc: 'Alerts & rotation' },
      { name: 'Pure Chalk', hex: '#FFFFFF', desc: 'Card background' },
    ],
    palette: { canvas: '#E7EDF5', surface: '#F8FAFD', primary: '#4F46E5', secondary: '#0284C7' },
    sidelineAdvantage: 'Engineered specifically for direct bright sunlight, eliminating reflections on iPads and iPhones.',
  },
  {
    id: 'varsity_chalk_crimson',
    name: 'Varsity Chalk & Heritage Crimson',
    subtitle: 'Historic Football Tradition & Whiteboard Clarity',
    category: 'Vintage Heritage',
    mode: 'light',
    vibe: 'Distinguished collegiate powerhouse aesthetic with warm bone surfaces, deep crimson typography, and antique gold trim.',
    bgGradient: 'from-stone-100 via-rose-50/40 to-amber-50/40',
    cardBg: 'bg-stone-50/95',
    cardBorder: 'border-stone-300 hover:border-rose-400',
    starterBadge: {
      bg: 'bg-rose-800 text-white',
      border: 'border-rose-700',
      text: 'text-white font-black',
      label: 'STARTER • CRIMSON',
    },
    backupBadge: {
      bg: 'bg-amber-100 text-amber-900',
      border: 'border-amber-300',
      text: 'text-amber-900 font-bold',
      label: 'GOLD • VARSITY',
    },
    reserveBadge: {
      bg: 'bg-stone-200 text-stone-800',
      border: 'border-stone-300',
      text: 'text-stone-800',
      label: 'BLUE • CHALK',
    },
    launchpadCard: {
      gradient: 'from-stone-50 via-white to-rose-50/40',
      border: 'border-stone-300 hover:border-rose-400',
      iconBg: 'bg-rose-100 border-rose-200',
      iconText: 'text-rose-800',
      titleColor: 'text-stone-900 group-hover:text-rose-800',
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-900 border-rose-200',
    },
    wristband: {
      headerBg: 'bg-rose-800 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-rose-50 border-rose-200',
      rightRowBg: 'bg-amber-50 border-amber-200',
      tagBg: 'bg-rose-800 text-white',
    },
    swatches: [
      { name: 'Warm Bone', hex: '#FAF8F5', desc: 'Soft daylight canvas' },
      { name: 'Varsity Crimson', hex: '#991B1B', desc: 'Primary identity & starters' },
      { name: 'Antique Gold', hex: '#D97706', desc: 'Rotation & highlights' },
      { name: 'Slate Charcoal', hex: '#1E293B', desc: 'High-legibility text' },
    ],
    palette: { canvas: '#EFE9E1', surface: '#FAF8F5', primary: '#991B1B', secondary: '#B45309' },
    sidelineAdvantage: 'Soft warm-spectrum white canvas prevents eye fatigue during 3-hour afternoon scrimmages and coaches meetings.',
  },
  {
    id: 'pacific_mist_navy',
    name: 'Pacific Mist & Coastal Navy',
    subtitle: 'Deep Sea Navy & Vibrant Action Teal',
    category: 'Modern Pro',
    mode: 'light',
    vibe: 'Crisp coastal gridiron style featuring marine navy anchors, clean mist backgrounds, and energetic teal action highlights.',
    bgGradient: 'from-slate-100 via-sky-50/50 to-teal-50/40',
    cardBg: 'bg-white',
    cardBorder: 'border-slate-300 hover:border-teal-500',
    starterBadge: {
      bg: 'bg-slate-900 text-teal-300',
      border: 'border-teal-400',
      text: 'text-teal-300 font-black',
      label: 'STARTER • NAVY',
    },
    backupBadge: {
      bg: 'bg-teal-50 text-teal-900',
      border: 'border-teal-300',
      text: 'text-teal-900 font-bold',
      label: 'GOLD • TEAL',
    },
    reserveBadge: {
      bg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-300',
      text: 'text-slate-700',
      label: 'BLUE • MIST',
    },
    launchpadCard: {
      gradient: 'from-white via-slate-50 to-teal-50/30',
      border: 'border-slate-300 hover:border-teal-400',
      iconBg: 'bg-teal-50 border-teal-200',
      iconText: 'text-teal-700',
      titleColor: 'text-slate-900 group-hover:text-teal-700',
      badgeBg: 'bg-teal-100',
      badgeText: 'text-teal-800 border-teal-200',
    },
    wristband: {
      headerBg: 'bg-slate-900 text-teal-300',
      headerText: 'text-teal-300 font-black',
      leftRowBg: 'bg-teal-50 border-teal-200',
      rightRowBg: 'bg-slate-50 border-slate-200',
      tagBg: 'bg-slate-900 text-teal-300',
    },
    swatches: [
      { name: 'Pacific Mist', hex: '#F0F4F8', desc: 'Cool daylight ground' },
      { name: 'Marine Navy', hex: '#0F172A', desc: 'Solid contrast ink' },
      { name: 'Action Teal', hex: '#0D9488', desc: 'Key play callouts' },
      { name: 'Seafoam Pure', hex: '#FFFFFF', desc: 'Surface brightness' },
    ],
    palette: { canvas: '#E3EAF2', surface: '#F7FAFC', primary: '#0D9488', secondary: '#1D4ED8' },
    sidelineAdvantage: 'Deep navy provides 14:1 contrast ratios on bright displays while teal flags crucial adjustments.',
  },
  {
    id: 'sahara_sand_blaze',
    name: 'Sahara Sand & Desert Blaze',
    subtitle: 'Sunbelt Athletic & Desert Terrain Clarity',
    category: 'Tactical',
    mode: 'light',
    vibe: 'Warm desert sand foundation with blazing terracotta orange and deep evergreen accents, engineered for high-UV conditions.',
    bgGradient: 'from-amber-50/70 via-stone-50 to-orange-50/50',
    cardBg: 'bg-stone-50',
    cardBorder: 'border-stone-300 hover:border-orange-500',
    starterBadge: {
      bg: 'bg-orange-600 text-white',
      border: 'border-orange-500',
      text: 'text-white font-black',
      label: 'STARTER • BLAZE',
    },
    backupBadge: {
      bg: 'bg-stone-200 text-stone-900',
      border: 'border-stone-400',
      text: 'text-stone-900 font-bold',
      label: 'GOLD • SAND',
    },
    reserveBadge: {
      bg: 'bg-stone-100 text-stone-700',
      border: 'border-stone-300',
      text: 'text-stone-700',
      label: 'BLUE • DESERT',
    },
    launchpadCard: {
      gradient: 'from-stone-50 via-white to-orange-50/30',
      border: 'border-stone-300 hover:border-orange-400',
      iconBg: 'bg-orange-100 border-orange-200',
      iconText: 'text-orange-700',
      titleColor: 'text-stone-900 group-hover:text-orange-700',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-800 border-orange-200',
    },
    wristband: {
      headerBg: 'bg-orange-600 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-orange-50 border-orange-200',
      rightRowBg: 'bg-stone-100 border-stone-200',
      tagBg: 'bg-orange-600 text-white',
    },
    swatches: [
      { name: 'Sahara Sand', hex: '#FBF8F3', desc: 'Anti-glare ground' },
      { name: 'Desert Blaze', hex: '#C2410C', desc: 'High-visibility callout' },
      { name: 'Canyon Earth', hex: '#78350F', desc: 'Depth & typography' },
      { name: 'Cactus Sage', hex: '#365314', desc: 'Sub-package accents' },
    ],
    palette: { canvas: '#F0E9DE', surface: '#FCFAF6', primary: '#C2410C', secondary: '#4D7C0F' },
    sidelineAdvantage: 'Custom warm-sand luminance suppresses harsh blue-light reflections on southern turf fields.',
  },
  {
    id: 'platinum_trophy_amber',
    name: 'Championship Platinum & Trophy Amber',
    subtitle: 'Golden Era Varsity & Prestigious Program Luster',
    category: 'Championship',
    mode: 'light',
    vibe: 'Luminous platinum-white cards accented by rich metallic bronze-amber and crisp onyx detailing for an elite championship finish.',
    bgGradient: 'from-slate-100 via-amber-50/30 to-slate-50',
    cardBg: 'bg-white',
    cardBorder: 'border-amber-300 hover:border-amber-500',
    starterBadge: {
      bg: 'bg-amber-500 text-slate-950',
      border: 'border-amber-400',
      text: 'text-slate-950 font-black',
      label: 'STARTER • GOLD',
    },
    backupBadge: {
      bg: 'bg-amber-100 text-amber-900',
      border: 'border-amber-300',
      text: 'text-amber-900 font-bold',
      label: 'GOLD • BRONZE',
    },
    reserveBadge: {
      bg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-300',
      text: 'text-slate-700',
      label: 'BLUE • PLATINUM',
    },
    launchpadCard: {
      gradient: 'from-white via-amber-50/20 to-slate-50',
      border: 'border-amber-300 hover:border-amber-500',
      iconBg: 'bg-amber-100 border-amber-300',
      iconText: 'text-amber-800',
      titleColor: 'text-slate-900 group-hover:text-amber-800',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-900 border-amber-300',
    },
    wristband: {
      headerBg: 'bg-amber-500 text-slate-950',
      headerText: 'text-slate-950 font-black',
      leftRowBg: 'bg-amber-50 border-amber-200',
      rightRowBg: 'bg-slate-50 border-slate-200',
      tagBg: 'bg-amber-500 text-slate-950',
    },
    swatches: [
      { name: 'Bright Platinum', hex: '#F8FAFC', desc: 'Clear daylight field' },
      { name: 'Trophy Amber', hex: '#B45309', desc: 'Metallic championship gold' },
      { name: 'Charcoal Onyx', hex: '#18181B', desc: 'Razor-sharp text' },
      { name: 'Warm Champagne', hex: '#FEF3C7', desc: 'Accent highlight' },
    ],
    palette: { canvas: '#E8ECF2', surface: '#F9FBFD', primary: '#B45309', secondary: '#57534E' },
    sidelineAdvantage: 'Combines prestigious varsity elegance with maximum text contrast on paper wristband exports and digital tablets.',
  },
  {
    id: 'turf_science_emerald',
    name: 'Turf Science & High-Vis Emerald',
    subtitle: 'Performance Lab & Modern Analytics Gridiron',
    category: 'Sports Tech',
    mode: 'light',
    vibe: 'Cutting-edge athletic science look with crisp pure paper backdrops, deep field emerald, and sharp high-vis lime accents.',
    bgGradient: 'from-emerald-50/50 via-slate-50 to-lime-50/40',
    cardBg: 'bg-white',
    cardBorder: 'border-emerald-300 hover:border-emerald-500',
    starterBadge: {
      bg: 'bg-emerald-700 text-white',
      border: 'border-emerald-600',
      text: 'text-white font-black',
      label: 'STARTER • EMERALD',
    },
    backupBadge: {
      bg: 'bg-lime-100 text-lime-900',
      border: 'border-lime-300',
      text: 'text-lime-900 font-bold',
      label: 'GOLD • LIME',
    },
    reserveBadge: {
      bg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-300',
      text: 'text-slate-700',
      label: 'BLUE • TURF',
    },
    launchpadCard: {
      gradient: 'from-white via-emerald-50/20 to-slate-50',
      border: 'border-emerald-300 hover:border-emerald-500',
      iconBg: 'bg-emerald-100 border-emerald-300',
      iconText: 'text-emerald-800',
      titleColor: 'text-slate-900 group-hover:text-emerald-800',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-900 border-emerald-300',
    },
    wristband: {
      headerBg: 'bg-emerald-700 text-white',
      headerText: 'text-white font-black',
      leftRowBg: 'bg-emerald-50 border-emerald-200',
      rightRowBg: 'bg-lime-50 border-lime-200',
      tagBg: 'bg-emerald-700 text-white',
    },
    swatches: [
      { name: 'Pure Paper', hex: '#FAFAFA', desc: 'Ultra-crisp background' },
      { name: 'Deep Turf Emerald', hex: '#047857', desc: 'Primary unit branding' },
      { name: 'High-Vis Lime', hex: '#65A30D', desc: 'Key indicators & motion' },
      { name: 'Deep Pitch', hex: '#064E3B', desc: 'Text & card lines' },
    ],
    palette: { canvas: '#E6EAE7', surface: '#FAFBFA', primary: '#047857', secondary: '#4D7C0F' },
    sidelineAdvantage: 'Organic gridiron colors feel natural on the field while providing maximum luminance separation for play calls.',
  },
];

interface ThemeGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedThemeId?: string;
  onSelectTheme?: (themeId: string) => void;
  themeMode?: 'dark' | 'light';
  onToggleThemeMode?: (mode: 'dark' | 'light') => void;
}

export const ThemeGalleryModal: React.FC<ThemeGalleryModalProps> = ({
  isOpen,
  onClose,
  selectedThemeId = 'electric_volt',
  onSelectTheme,
  themeMode = 'dark',
  onToggleThemeMode,
}) => {
  const [activeTabThemeId, setActiveTabThemeId] = useState<string>(selectedThemeId);
  const [appliedThemeId, setAppliedThemeId] = useState<string>(selectedThemeId);
  const [filterMode, setFilterMode] = useState<'all' | 'dark' | 'light'>('all');

  if (!isOpen) return null;

  const currentTheme = THEME_SCHEMES.find((s) => s.id === activeTabThemeId) || THEME_SCHEMES[0];

  const filteredSchemes = THEME_SCHEMES.filter((scheme) => {
    if (filterMode === 'all') return true;
    return scheme.mode === filterMode;
  });

  const handleApply = (themeId: string) => {
    setAppliedThemeId(themeId);
    const targetScheme = THEME_SCHEMES.find((s) => s.id === themeId);
    if (targetScheme && onToggleThemeMode) {
      if (targetScheme.mode === 'light' && themeMode !== 'light') {
        onToggleThemeMode('light');
      } else if (targetScheme.mode === 'dark' && themeMode !== 'dark') {
        onToggleThemeMode('dark');
      }
    }
    if (onSelectTheme) {
      onSelectTheme(themeId);
    }
  };

  const isCurrentSchemeLight = currentTheme.mode === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-850 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Sideline Visual Scheme Showcase
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                  12 Schemes • 6 Dark &amp; 6 Light
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Modern professional themes optimized for stadium night glare, direct sunlight, and high-contrast sideline playcalling.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Light / Dark Mode Global Toggle */}
            {onToggleThemeMode && (
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onToggleThemeMode('dark')}
                  title="Dark Mode (Night Stadium)"
                  className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-slate-900 text-indigo-300 shadow-xs border border-indigo-500/40'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">App: Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleThemeMode('light')}
                  title="Light Mode (Daylight Field)"
                  className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-amber-100 text-amber-900 shadow-xs border border-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">App: Light</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. Category Filter Segmented Control */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Schemes (12)
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('dark')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterMode === 'dark'
                    ? 'bg-slate-900 text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>6 Dark Themes</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('light')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterMode === 'light'
                    ? 'bg-amber-100 text-amber-900 shadow-xs border border-amber-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>6 Light Themes</span>
              </button>
            </div>

            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Showing {filteredSchemes.length} modern professional themes</span>
            </div>
          </div>

          {/* 2. Theme Scheme Cards Carousel / Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {filteredSchemes.map((scheme) => {
              const isActive = scheme.id === currentTheme.id;
              const isApplied = scheme.id === appliedThemeId;
              const isLight = scheme.mode === 'light';

              return (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => setActiveTabThemeId(scheme.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 border-indigo-600 dark:border-indigo-400 shadow-md ring-2 ring-indigo-500/30'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-90 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                          isLight
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-slate-800 text-indigo-300 border border-slate-700'
                        }`}
                      >
                        {isLight ? <Sun className="w-2.5 h-2.5 text-amber-600" /> : <Moon className="w-2.5 h-2.5" />}
                        {isLight ? 'Light' : 'Dark'}
                      </span>
                      {isApplied && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black shadow-xs">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-black text-slate-900 dark:text-white line-clamp-2 leading-tight">
                      {scheme.name}
                    </div>

                    <div className="text-[9.5px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {scheme.category}
                    </div>
                  </div>

                  {/* Tiny Color Swatch Preview Bar */}
                  <div className="flex gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {scheme.swatches.map((sw, i) => (
                      <span
                        key={i}
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs shrink-0"
                        style={{ backgroundColor: sw.hex }}
                        title={`${sw.name} (${sw.hex})`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. Active Scheme Showcase Card (Adaptive Light vs Dark View) */}
          <div
            className={`rounded-3xl border ${currentTheme.cardBorder} p-4 sm:p-6 bg-gradient-to-br ${currentTheme.bgGradient} space-y-5 shadow-2xl relative overflow-hidden transition-all duration-300`}
          >
            {/* Theme Hero Header */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${isCurrentSchemeLight ? 'border-slate-300/80' : 'border-white/10'}`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                      isCurrentSchemeLight
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    {isCurrentSchemeLight ? <Sun className="w-3 h-3 text-amber-600" /> : <Moon className="w-3 h-3" />}
                    {isCurrentSchemeLight ? 'Light Theme Scheme' : 'Dark Theme Scheme'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isCurrentSchemeLight ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white border border-white/20'}`}>
                    {currentTheme.category}
                  </span>
                  <span className={`text-xs font-bold ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {currentTheme.subtitle}
                  </span>
                </div>
                <h3 className={`text-lg sm:text-2xl font-black mt-1.5 ${isCurrentSchemeLight ? 'text-slate-950' : 'text-white'}`}>
                  {currentTheme.name}
                </h3>
                <p className={`text-xs sm:text-sm font-medium mt-1 max-w-3xl leading-relaxed ${isCurrentSchemeLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {currentTheme.vibe}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApply(currentTheme.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md ${
                    appliedThemeId === currentTheme.id
                      ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                      : isCurrentSchemeLight
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {appliedThemeId === currentTheme.id
                      ? 'Active App Theme'
                      : `Apply ${isCurrentSchemeLight ? 'Light' : 'Dark'} Scheme`}
                  </span>
                </button>
              </div>
            </div>

            {/* Visual Component Previews Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Preview 1: Mobile Depth Chart Card */}
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  isCurrentSchemeLight
                    ? 'bg-white/90 backdrop-blur-md border-slate-300 shadow-sm text-slate-900'
                    : 'bg-black/60 backdrop-blur-md border-white/10 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    <Shield className="w-3.5 h-3.5" />
                    Depth Chart Card (Mobile)
                  </span>
                  <span className={`text-[9.5px] font-bold ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    I-Formation • QB
                  </span>
                </div>

                {/* Starter Slot */}
                <div
                  className={`border rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs ${
                    isCurrentSchemeLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-900/90 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg font-mono font-black text-xs flex items-center justify-center border ${
                        isCurrentSchemeLight
                          ? 'bg-white text-slate-900 border-slate-300'
                          : 'bg-black text-white border-zinc-700'
                      }`}
                    >
                      #12
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-black truncate ${isCurrentSchemeLight ? 'text-slate-950' : 'text-white'}`}>
                        Jaxson Dart
                      </div>
                      <div className={`text-[10px] font-bold ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        1st String Starter
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shadow-xs ${currentTheme.starterBadge.bg} ${currentTheme.starterBadge.text} border ${currentTheme.starterBadge.border}`}
                  >
                    {currentTheme.starterBadge.label.split('•')[0].trim()}
                  </span>
                </div>

                {/* Rotation / Backup Slot */}
                <div
                  className={`border rounded-xl p-2.5 flex items-center justify-between gap-2 opacity-95 ${
                    isCurrentSchemeLight
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg font-mono font-black text-xs flex items-center justify-center border ${
                        isCurrentSchemeLight
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-zinc-800 text-slate-300 border-zinc-700'
                      }`}
                    >
                      #7
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-black truncate ${isCurrentSchemeLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        C. Williams
                      </div>
                      <div className={`text-[10px] font-bold ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Rotation Backup
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${currentTheme.backupBadge.bg} ${currentTheme.backupBadge.text} border ${currentTheme.backupBadge.border}`}
                  >
                    {currentTheme.backupBadge.label.split('•')[0].trim()}
                  </span>
                </div>
              </div>

              {/* Preview 2: Mobile Launchpad Quick Tile */}
              <div
                className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
                  isCurrentSchemeLight
                    ? 'bg-white/90 backdrop-blur-md border-slate-300 shadow-sm text-slate-900'
                    : 'bg-black/60 backdrop-blur-md border-white/10 text-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      <Zap className="w-3.5 h-3.5" />
                      Mobile Touch Launch Pad
                    </span>
                    <span className={`text-[9.5px] font-bold ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Quick Action
                    </span>
                  </div>

                  <div className={`bg-gradient-to-br ${currentTheme.launchpadCard.gradient} border ${currentTheme.launchpadCard.border} p-3.5 rounded-2xl shadow-md relative overflow-hidden group`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-xl ${currentTheme.launchpadCard.iconBg} ${currentTheme.launchpadCard.iconText} border flex items-center justify-center`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${currentTheme.launchpadCard.badgeBg} ${currentTheme.launchpadCard.badgeText} border`}>
                        Active View
                      </span>
                    </div>
                    <div className={`text-sm font-black ${currentTheme.launchpadCard.titleColor}`}>
                      Depth Chart Matrix
                    </div>
                    <div className={`text-[11px] font-medium ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Pocket Card &amp; Personnel Matrix
                    </div>
                  </div>
                </div>

                <div className={`pt-2 text-[10px] italic ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Instant touch response with high-contrast target borders.
                </div>
              </div>

              {/* Preview 3: Wristband Callout & Swatches */}
              <div
                className={`rounded-2xl border p-4 space-y-3 flex flex-col justify-between ${
                  isCurrentSchemeLight
                    ? 'bg-white/90 backdrop-blur-md border-slate-300 shadow-sm text-slate-900'
                    : 'bg-black/60 backdrop-blur-md border-white/10 text-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      <Watch className="w-3.5 h-3.5" />
                      Wristband Callout
                    </span>
                    <span className={`text-[9.5px] font-bold ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      High Vis
                    </span>
                  </div>

                  <div className="border border-slate-300 dark:border-black rounded-xl overflow-hidden shadow-xs">
                    <div className={`px-2.5 py-1 text-[11px] ${currentTheme.wristband.headerBg} ${currentTheme.wristband.headerText} flex items-center justify-between`}>
                      <span className="font-black">RED • RUN</span>
                      <span className="font-mono font-black">#24</span>
                    </div>
                    <div
                      className={`p-2 border-t text-xs font-black flex items-center justify-between ${
                        isCurrentSchemeLight
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-slate-900 border-slate-800 text-white'
                      }`}
                    >
                      <span>I-Right 24 Power Lead</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isCurrentSchemeLight
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-400/20 text-amber-300'
                        }`}
                      >
                        P1
                      </span>
                    </div>
                  </div>
                </div>

                {/* Swatches List */}
                <div className={`pt-2 border-t space-y-1.5 ${isCurrentSchemeLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className={`text-[10px] font-black uppercase ${isCurrentSchemeLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Palette Color Tokens
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentTheme.swatches.map((sw, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                          isCurrentSchemeLight
                            ? 'bg-slate-50 border-slate-200 text-slate-800'
                            : 'bg-black/40 border-white/5 text-white'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20"
                          style={{ backgroundColor: sw.hex }}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold truncate leading-tight">
                            {sw.name}
                          </div>
                          <div className={`text-[8.5px] font-mono leading-none ${isCurrentSchemeLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {sw.hex}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sideline Advantage Callout */}
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-3 border ${
                isCurrentSchemeLight
                  ? 'bg-white/80 border-slate-300 text-slate-900'
                  : 'bg-white/5 border-white/10 text-slate-200'
              }`}
            >
              <Sparkles className={`w-5 h-5 shrink-0 ${isCurrentSchemeLight ? 'text-indigo-600' : 'text-amber-400'}`} />
              <div className="text-xs leading-relaxed">
                <span className={`font-black ${isCurrentSchemeLight ? 'text-slate-950' : 'text-white'}`}>
                  Sideline Visibility Advantage:{' '}
                </span>
                {currentTheme.sidelineAdvantage}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            12 Sideline schemes available (6 dark stadium, 6 daylight sun). Applying a scheme updates visual presets and theme mode automatically.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Close Showcase
          </button>
        </div>
      </div>
    </div>
  );
};

