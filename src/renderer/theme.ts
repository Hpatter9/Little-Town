// How the game looks. Each origin has its own look (data/origins.ts), and a lich founder makes any town a necropolis:
// a palette for every menu, window, tab bar, button, bar and card (generated into one stylesheet, scoped to
// html.theme-<id>), a font and a glyph for window titles, a drift of mist (or scan-lines) over the menus, a colour cast
// over the town itself, a tint on its buildings, and new names for some menus. Each page (the phone's frame, the
// menus, the town strip) calls applyTheme with every snapshot; only a change does anything.

import type { PanelId } from '../shared/ipc';
import type { ThemeId } from '../shared/sim/snapshot';
import { skinCss } from './skins';
import { fontFaces, fontStacks } from './fonts';

export type Theme = ThemeId;
export type Page = 'phone' | 'panel' | 'strip';

interface Palette {
  /** Page, panel and header backgrounds. */
  bg: string;
  wood: string;
  header: [string, string];
  /** Edges, buttons, the chosen button and its rim, and its glow. */
  edge: string;
  btn: string;
  btnHover: string;
  on: string;
  onRim: string;
  glow: string;
  text: string;
  dim: string;
  /** Headings (and their glow), and bars (full and low). */
  heading: string;
  headingGlow: string;
  fill: [string, string];
  low: [string, string];
  card: string;
  /** Before each window's title (a CSS escape). */
  glyph: string;
  /** Over the menus: three soft blots of colour, or the machines' scan-lines. */
  mist: [string, string, string] | 'scanlines';
  /** The town: a colour cast over it, and a vignette. */
  canvas: string;
  vignette: string;
  /** (unused now: the sky behind the phone's frame takes the town's own colour cast, so the two run on seamlessly) */
  page: [string, string, string];
  /** The menus' new names. */
  labels: Partial<Record<PanelId, string>>;
  /** Buildings are tinted toward this colour, this much. */
  tint: [string, number];
}

const PALETTES: Record<Exclude<ThemeId, 'town'>, Palette> = {
  lich: {
    bg: '#120e16', wood: 'rgba(20, 14, 26, 0.96)', header: ['#221a2c', '#17111e'],
    edge: '#4f6b3a', btn: '#241c2e', btnHover: '#342a42', on: '#3d5a33', onRim: '#8ad070', glow: 'rgba(138, 208, 112, 0.45)',
    text: '#dfe8d0', dim: '#9aa88a', heading: '#a8d890', headingGlow: 'rgba(120, 220, 120, 0.35)',
    fill: ['#3f7a34', '#9ae070'], low: ['#5a1a3a', '#a83a6a'], card: 'rgba(24, 18, 32, 0.95)',
    glyph: '\\2620',
    mist: ['rgba(140, 220, 140, 0.07)', 'rgba(170, 120, 220, 0.08)', 'rgba(160, 200, 160, 0.06)'],
    canvas: 'saturate(0.5) hue-rotate(-18deg) brightness(0.88) contrast(1.08)', vignette: 'rgba(18, 4, 28, 0.55)',
    page: ['#07050b', '#150e1e', '#120e16'],
    labels: { build: 'Designs', research: 'Grimoire', townsfolk: 'Souls', journal: 'Chronicle' },
    tint: ['#7a8a70', 0.35],
  },
  druid: {
    bg: '#10170e', wood: 'rgba(18, 28, 16, 0.96)', header: ['#1e2c18', '#141f10'],
    edge: '#6a8a3a', btn: '#1e2a1a', btnHover: '#2a3a22', on: '#3f6a2a', onRim: '#b8e070', glow: 'rgba(170, 220, 100, 0.4)',
    text: '#e6efd6', dim: '#a3b58a', heading: '#b8e08a', headingGlow: 'rgba(160, 220, 110, 0.35)',
    fill: ['#4a8a2a', '#b8e070'], low: ['#7a4a1a', '#c08030'], card: 'rgba(22, 32, 18, 0.95)',
    glyph: '\\2766',
    mist: ['rgba(180, 230, 120, 0.07)', 'rgba(240, 220, 120, 0.05)', 'rgba(120, 200, 120, 0.06)'],
    canvas: 'saturate(1.25) hue-rotate(8deg) brightness(1.02)', vignette: 'rgba(10, 30, 6, 0.35)',
    page: ['#081006', '#122012', '#10170e'],
    labels: { build: 'Grove Plans', research: 'Lore', townsfolk: 'Circle', journal: 'Seasons' },
    tint: ['#4a7a2a', 0.22],
  },
  vampire: {
    bg: '#12070a', wood: 'rgba(26, 8, 12, 0.96)', header: ['#2a0c14', '#1a060c'],
    edge: '#7a1a2a', btn: '#2a0e14', btnHover: '#3a1420', on: '#6a1424', onRim: '#e0506a', glow: 'rgba(220, 40, 70, 0.45)',
    text: '#f0dada', dim: '#b08a8e', heading: '#ff8a9a', headingGlow: 'rgba(220, 40, 70, 0.4)',
    fill: ['#7a1024', '#e0405a'], low: ['#3a0a14', '#7a1a2a'], card: 'rgba(32, 10, 16, 0.95)',
    glyph: '\\2720',
    mist: ['rgba(200, 30, 60, 0.07)', 'rgba(120, 20, 40, 0.08)', 'rgba(180, 60, 90, 0.05)'],
    canvas: 'saturate(0.7) hue-rotate(-12deg) brightness(0.8) contrast(1.1)', vignette: 'rgba(40, 0, 10, 0.6)',
    page: ['#070204', '#1a060c', '#12070a'],
    labels: { build: 'Decrees', research: 'Blood Lore', townsfolk: 'Thralls', journal: 'Annals' },
    tint: ['#5a1020', 0.28],
  },
  werewolf: {
    bg: '#0b1018', wood: 'rgba(14, 20, 32, 0.96)', header: ['#18223a', '#101828'],
    edge: '#5a7aa8', btn: '#182236', btnHover: '#22304a', on: '#2e4a78', onRim: '#9ac0f0', glow: 'rgba(140, 180, 255, 0.45)',
    text: '#e2eaf6', dim: '#93a4bd', heading: '#b8d4ff', headingGlow: 'rgba(140, 180, 255, 0.4)',
    fill: ['#3a5a9a', '#a8c8ff'], low: ['#5a2a2a', '#a04a3a'], card: 'rgba(18, 26, 40, 0.95)',
    glyph: '\\263E',
    mist: ['rgba(160, 190, 255, 0.07)', 'rgba(220, 230, 255, 0.05)', 'rgba(100, 140, 220, 0.06)'],
    canvas: 'saturate(0.75) hue-rotate(15deg) brightness(0.9)', vignette: 'rgba(4, 10, 30, 0.5)',
    page: ['#04070e', '#0e1626', '#0b1018'],
    labels: { build: 'Den Plans', research: 'Moon Lore', townsfolk: 'Pack', journal: 'Hunts' },
    tint: ['#3a4a6a', 0.22],
  },
  robot: {
    bg: '#07100c', wood: 'rgba(8, 16, 12, 0.96)', header: ['#0e2018', '#08140e'],
    edge: '#2ad07a', btn: '#0e1c16', btnHover: '#15281f', on: '#125a36', onRim: '#5affa8', glow: 'rgba(80, 255, 160, 0.45)',
    text: '#c8ffe0', dim: '#6ab08a', heading: '#5affa8', headingGlow: 'rgba(80, 255, 160, 0.45)',
    fill: ['#1a8a4a', '#6affb0'], low: ['#8a5a1a', '#e0a040'], card: 'rgba(10, 22, 16, 0.95)',
    glyph: '\\25A3',
    mist: 'scanlines',
    canvas: 'saturate(0.55) contrast(1.15) brightness(0.95)', vignette: 'rgba(0, 20, 10, 0.45)',
    page: ['#020604', '#08140e', '#07100c'],
    labels: { build: 'Build Queue', research: 'Databank', townsfolk: 'Units', crafting: 'Fabrication', expeditions: 'Sorties', journal: 'Log' },
    tint: ['#8a969c', 0.45],
  },
  dwarves: {
    bg: '#15110c', wood: 'rgba(30, 24, 18, 0.96)', header: ['#2e2418', '#1e1810'],
    edge: '#b88a3a', btn: '#2a221a', btnHover: '#3a2e22', on: '#6a4a20', onRim: '#f0c060', glow: 'rgba(240, 190, 90, 0.4)',
    text: '#f4e6cc', dim: '#b8a484', heading: '#f0c060', headingGlow: 'rgba(240, 190, 90, 0.35)',
    fill: ['#a86a1a', '#f0c060'], low: ['#6a2a1a', '#a84a2a'], card: 'rgba(36, 28, 20, 0.95)',
    glyph: '\\2692',
    mist: ['rgba(240, 160, 60, 0.05)', 'rgba(200, 120, 40, 0.05)', 'rgba(160, 140, 120, 0.05)'],
    canvas: 'saturate(0.9) sepia(0.2) brightness(0.92)', vignette: 'rgba(20, 10, 0, 0.45)',
    page: ['#0a0805', '#1c150e', '#15110c'],
    labels: { build: 'Hall Plans', research: 'Runes', townsfolk: 'Clan', journal: 'Sagas' },
    tint: ['#6a6a70', 0.25],
  },
  merfolk: {
    bg: '#06121a', wood: 'rgba(8, 22, 32, 0.96)', header: ['#0e2a3a', '#081c28'],
    edge: '#3aa8b8', btn: '#0e2230', btnHover: '#163044', on: '#146a7a', onRim: '#7ae8f0', glow: 'rgba(120, 230, 240, 0.4)',
    text: '#d8f4f8', dim: '#88b8c4', heading: '#7ae8f0', headingGlow: 'rgba(120, 230, 240, 0.4)',
    fill: ['#1a7a8a', '#8af0f0'], low: ['#6a3a2a', '#b06040'], card: 'rgba(10, 28, 40, 0.95)',
    glyph: '\\2248',
    mist: ['rgba(120, 220, 240, 0.07)', 'rgba(80, 160, 220, 0.06)', 'rgba(200, 240, 250, 0.05)'],
    canvas: 'saturate(0.9) hue-rotate(10deg) brightness(0.97)', vignette: 'rgba(0, 30, 40, 0.35)',
    page: ['#030a10', '#0a1c28', '#06121a'],
    labels: { build: 'Harbour Plans', research: 'Sea Lore', townsfolk: 'Shoal', journal: 'Tides' },
    tint: ['#3a8a9a', 0.22],
  },
  // (the one bright theme: the menus are a tent of cream canvas and dyed stripes, see skins.ts)
  nomads: {
    bg: '#f6e8c8', wood: 'rgba(253, 245, 226, 0.97)', header: ['#c0392b', '#a0301f'],
    edge: '#b83a2a', btn: '#fdf5e2', btnHover: '#f0dcb0', on: '#c0392b', onRim: '#e8c040', glow: 'rgba(232, 160, 48, 0.45)',
    text: '#3a2414', dim: '#7a5a3a', heading: '#b83a2a', headingGlow: 'rgba(255, 255, 255, 0.6)',
    fill: ['#c0392b', '#e8a030'], low: ['#6a2a1a', '#a84a2a'], card: '#fdf5e2',
    glyph: '\\2726',
    mist: ['rgba(240, 180, 100, 0.06)', 'rgba(220, 140, 60, 0.05)', 'rgba(250, 210, 150, 0.05)'],
    canvas: 'saturate(1.1) sepia(0.25) brightness(1.03)', vignette: 'rgba(40, 20, 0, 0.3)',
    page: ['#0e0904', '#241810', '#1a120a'],
    labels: { build: 'Camp Plans', townsfolk: 'Kin', trade: 'Bazaar', journal: 'Road Tales' },
    tint: ['#c89050', 0.22],
  },
  fae: {
    bg: '#140c1a', wood: 'rgba(28, 16, 36, 0.94)', header: ['#2c1a3a', '#1e1028'],
    edge: '#d07ae0', btn: '#2a1836', btnHover: '#3a2248', on: '#6a3a86', onRim: '#f8b0ff', glow: 'rgba(255, 160, 255, 0.45)',
    text: '#fbeaff', dim: '#c4a4d0', heading: '#ffc4ff', headingGlow: 'rgba(255, 160, 255, 0.45)',
    fill: ['#a04ad0', '#ffb8f8'], low: ['#5a2a4a', '#a04a7a'], card: 'rgba(34, 20, 44, 0.94)',
    glyph: '\\2727',
    mist: ['rgba(255, 170, 255, 0.08)', 'rgba(140, 240, 230, 0.06)', 'rgba(255, 230, 160, 0.05)'],
    canvas: 'saturate(1.3) hue-rotate(-25deg) brightness(1.05)', vignette: 'rgba(40, 0, 50, 0.35)',
    page: ['#0a0610', '#1e1028', '#140c1a'],
    labels: { build: 'Wishes', research: 'Enchantments', townsfolk: 'Court', journal: 'Dreams' },
    tint: ['#c080e0', 0.22],
  },
  alchemists: {
    bg: '#0e0f14', wood: 'rgba(18, 18, 26, 0.96)', header: ['#20202e', '#16161e'],
    edge: '#c8a03a', btn: '#1e1e2a', btnHover: '#2a2a38', on: '#4a3a1a', onRim: '#e0c060', glow: 'rgba(160, 255, 120, 0.3)',
    text: '#eee8d8', dim: '#a8a088', heading: '#e0c060', headingGlow: 'rgba(160, 255, 120, 0.25)',
    fill: ['#6a9a1a', '#e0e060'], low: ['#6a1a4a', '#a83a7a'], card: 'rgba(22, 22, 32, 0.95)',
    glyph: '\\2697',
    mist: ['rgba(160, 255, 120, 0.06)', 'rgba(220, 200, 90, 0.05)', 'rgba(180, 120, 255, 0.05)'],
    canvas: 'saturate(0.9) hue-rotate(-8deg) brightness(0.95)', vignette: 'rgba(10, 20, 0, 0.35)',
    page: ['#060608', '#14141c', '#0e0f14'],
    labels: { build: 'Formulae', research: 'Opus', crafting: 'Workings', journal: 'Notes' },
    tint: ['#8a7a40', 0.16],
  },
  knights: {
    bg: '#0e1016', wood: 'rgba(20, 22, 30, 0.96)', header: ['#262a36', '#1a1d26'],
    edge: '#9aa4b8', btn: '#22262f', btnHover: '#2e3340', on: '#3a4a6a', onRim: '#d8b860', glow: 'rgba(216, 184, 96, 0.4)',
    text: '#eef0f6', dim: '#a8aebc', heading: '#d8b860', headingGlow: 'rgba(216, 184, 96, 0.3)',
    fill: ['#3a5a9a', '#d8b860'], low: ['#6a1a1a', '#a83a3a'], card: 'rgba(26, 28, 38, 0.95)',
    glyph: '\\2720',
    mist: ['rgba(200, 210, 230, 0.05)', 'rgba(216, 184, 96, 0.04)', 'rgba(160, 170, 200, 0.05)'],
    canvas: 'saturate(0.85) brightness(0.96) contrast(1.05)', vignette: 'rgba(10, 10, 20, 0.35)',
    page: ['#06070a', '#161922', '#0e1016'],
    labels: { build: 'Fortifications', research: 'Studies', townsfolk: 'The Order', journal: 'Chronicle' },
    tint: ['#8a90a0', 0.2],
  },
};

export const panelLabel = (id: PanelId, label: string, theme: Theme) => (theme === 'town' ? label : (PALETTES[theme].labels[id] ?? label));
/** Buildings' tint in a theme (null: as drawn). */
export const buildingTint = (theme: Theme): [string, number] | null => (theme === 'town' ? null : PALETTES[theme].tint);

let current: Theme = 'town';

// every page: the bundled faces, and the base game's pair as the default (a theme overrides the two variables)
if (typeof document !== 'undefined' && !document.getElementById('fonts')) {
  const style = document.createElement('style');
  style.id = 'fonts';
  const [display, body] = fontStacks('town');
  style.textContent = `${fontFaces()}\n:root { --font-display: ${display}; --font-body: ${body}; }
:root h1, :root h2, :root .era-head, :root .shop-tier-name, :root #title, :root #top-title, :root .tab, :root #tabs button { font-family: var(--font-display); }`;
  document.head.prepend(style);
}
export const currentTheme = () => current;

/** Switch a page's look. Returns true when it changed (so the page can rename what it shows). */
export function applyTheme(theme: Theme, page: Page): boolean {
  if (theme === current) return false;
  const root = document.documentElement;
  root.classList.add(`page-${page}`);
  root.classList.remove(`theme-${current}`);
  current = theme;
  if (theme === 'town') return true;
  root.classList.add(`theme-${theme}`);
  if (!document.getElementById(`theme-${theme}`)) {
    const style = document.createElement('style');
    style.id = `theme-${theme}`;
    style.textContent = css(theme, PALETTES[theme]);
    document.head.append(style);
  }
  return true;
}

/** One theme's stylesheet: everything scoped to html.theme-<id>, so a page without some of it ignores that part. */
function css(id: string, p: Palette): string {
  const T = `html.theme-${id}`;
  const mist =
    p.mist === 'scanlines'
      ? 'repeating-linear-gradient(0deg, rgba(90, 255, 160, 0.05) 0 1px, transparent 1px 3px)'
      : `radial-gradient(ellipse 40% 25% at 20% 30%, ${p.mist[0]}, transparent 70%),
    radial-gradient(ellipse 35% 30% at 75% 65%, ${p.mist[1]}, transparent 70%),
    radial-gradient(ellipse 50% 20% at 50% 95%, ${p.mist[2]}, transparent 70%)`;
  return `
${T} {
  --bg: ${p.bg}; --wood: ${p.wood}; --wood-edge: ${p.edge}; --header: ${p.header[1]};
  --btn: ${p.btn}; --btn-hover: ${p.btnHover}; --btn-on: ${p.on}; --btn-active: ${p.on};
  --text: ${p.text}; --text-dim: ${p.dim};
}
${T} { --font-display: ${fontStacks(id)[0]}; --font-body: ${fontStacks(id)[1]}; }
${T}.page-panel body::after, ${T}.page-phone body::after {
  content: ''; position: fixed; inset: -10%; pointer-events: none; z-index: 50;
  background: ${mist};
  animation: theme-drift 22s ease-in-out infinite alternate;
}
@keyframes theme-drift { from { transform: translate(-3%, 1%); } to { transform: translate(3%, -2%); } }
${T}.page-phone body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  backdrop-filter: ${p.canvas}; -webkit-backdrop-filter: ${p.canvas};
}
${T} h1, ${T} h2, ${T} .era-head, ${T} .shop-tier-name {
  color: ${p.heading}; text-shadow: 0 0 6px ${p.headingGlow}; letter-spacing: 0.08em;
}
${T} #top-title { color: ${p.heading}; text-shadow: 0 0 8px ${p.headingGlow}; letter-spacing: 0.06em; }
${T} header { background: linear-gradient(${p.header[0]}, ${p.header[1]}); }
${T} #title::before { content: '${p.glyph}  '; color: ${p.onRim}; }
${T} .bar, ${T} .boss-track { background: rgba(0, 0, 0, 0.45); box-shadow: inset 0 0 0 1px ${p.btnHover}; }
${T} .bar-fill, ${T} .meter-fill { background: linear-gradient(90deg, ${p.fill[0]}, ${p.fill[1]}); box-shadow: 0 0 6px ${p.glow}; }
${T} .bar-fill.low { background: linear-gradient(90deg, ${p.low[0]}, ${p.low[1]}); }
${T} .card, ${T} .queue-row, ${T} #inspect, ${T} #menu { background: ${p.card}; border-color: ${p.btnHover}; }
${T} .chip { background: ${p.btn}; border: 1px solid ${p.btnHover}; }
${T} button:not(.swatch):not(.card), ${T} .place, ${T} .tab, ${T} #tabs button { background: var(--btn); border-color: rgba(0, 0, 0, 0.6); color: var(--text); }
${T} .place.on, ${T} .tab.on, ${T} #tabs button.on, ${T} button.primary {
  background: var(--btn-on); border-color: ${p.onRim}; box-shadow: 0 0 8px ${p.glow};
}
${T} .tab-fill { background: linear-gradient(${p.fill[1]}, ${p.fill[0]}); }
${T} .hint, ${T} .empty { color: ${p.dim}; }
${T} .shop-coins { color: ${p.heading}; }
${T} #prompt, ${T} #away, ${T} .toast, ${T} #tip, ${T} #person-card, ${T} #banner, ${T} #exp-header {
  background: ${p.wood}; border-color: ${p.edge}; color: var(--text); box-shadow: 0 0 10px ${p.glow};
}
${T} .shop-floor { filter: ${p.canvas}; }
${T}.page-strip canvas { filter: ${p.canvas}; }
${T}.page-strip body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 5;
  background: linear-gradient(90deg, ${p.vignette}, transparent 16%, transparent 84%, ${p.vignette});
}
${skinCss(id as Theme, T)}`;
}
