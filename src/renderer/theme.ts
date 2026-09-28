// How the game looks. Once the founder is a lich (their soul bound into a phylactery), the whole game turns: every
// page (the phone's frame, the menus, the town strip) takes on the necropolis look, with grave-dark purples, bone-pale
// text, sickly green light, and mist drifting over the menus; the town itself is drained of colour under a dark
// vignette; and some of the menus take new names. Each page calls applyTheme with every snapshot; only a change does
// anything. The look is one stylesheet, scoped to html.theme-lich, so pages without some of its parts ignore them.

import type { PanelId } from '../shared/ipc';

export type Theme = 'town' | 'lich';
export type Page = 'phone' | 'panel' | 'strip';

/** The menus' names in the necropolis. */
const LICH_LABELS: Partial<Record<PanelId, string>> = { build: 'Designs', research: 'Grimoire', townsfolk: 'Souls', journal: 'Chronicle' };
export const panelLabel = (id: PanelId, label: string, theme: Theme) => (theme === 'lich' ? (LICH_LABELS[id] ?? label) : label);
export const gameTitle = (theme: Theme) => (theme === 'lich' ? 'Chronos Necropolis' : 'Chronos Settlement');

let current: Theme = 'town';
export const currentTheme = () => current;

/** Switch a page's look. Returns true when it changed (so the page can rename what it shows). */
export function applyTheme(theme: Theme, page: Page): boolean {
  if (theme === current) return false;
  current = theme;
  const root = document.documentElement;
  root.classList.add(`page-${page}`);
  root.classList.toggle('theme-lich', theme === 'lich');
  if (theme === 'lich' && !document.getElementById('theme-lich')) {
    const style = document.createElement('style');
    style.id = 'theme-lich';
    style.textContent = LICH_CSS;
    document.head.append(style);
  }
  return true;
}

const LICH_CSS = `
html.theme-lich {
  --bg: #120e16;
  --wood: rgba(20, 14, 26, 0.96);
  --wood-edge: #4f6b3a;
  --header: #1c1624;
  --btn: #241c2e;
  --btn-hover: #342a42;
  --btn-on: #3d5a33;
  --btn-active: #3d5a33;
  --text: #dfe8d0;
  --text-dim: #9aa88a;
}
html.theme-lich body {
  font-family: Georgia, 'Palatino Linotype', 'Times New Roman', serif;
}
/* mist drifting over the menus and the phone's frame */
html.theme-lich.page-panel body::after,
html.theme-lich.page-phone body::after {
  content: '';
  position: fixed;
  inset: -10%;
  pointer-events: none;
  z-index: 50;
  background:
    radial-gradient(ellipse 40% 25% at 20% 30%, rgba(140, 220, 140, 0.07), transparent 70%),
    radial-gradient(ellipse 35% 30% at 75% 65%, rgba(170, 120, 220, 0.08), transparent 70%),
    radial-gradient(ellipse 50% 20% at 50% 95%, rgba(160, 200, 160, 0.06), transparent 70%);
  animation: lich-mist 22s ease-in-out infinite alternate;
}
@keyframes lich-mist {
  from { transform: translate(-3%, 1%); }
  to { transform: translate(3%, -2%); }
}
html.theme-lich.page-phone body {
  background: linear-gradient(#07050b, #150e1e 55%, #120e16) !important;
}
html.theme-lich h1,
html.theme-lich h2,
html.theme-lich .era-head,
html.theme-lich .shop-tier-name {
  color: #a8d890;
  text-shadow: 0 0 6px rgba(120, 220, 120, 0.35);
  letter-spacing: 0.08em;
}
html.theme-lich #top-title {
  color: #b8e0a0;
  text-shadow: 0 0 8px rgba(120, 220, 120, 0.4);
  letter-spacing: 0.06em;
}
html.theme-lich header {
  background: linear-gradient(#221a2c, #17111e);
}
html.theme-lich #title::before {
  content: '\\2620  ';
  color: #8ad070;
}
html.theme-lich .bar,
html.theme-lich .boss-track {
  background: #0c0a10;
  box-shadow: inset 0 0 0 1px #2a2234;
}
html.theme-lich .bar-fill {
  background: linear-gradient(90deg, #3f7a34, #9ae070);
  box-shadow: 0 0 6px rgba(111, 208, 106, 0.6);
}
html.theme-lich .bar-fill.low {
  background: linear-gradient(90deg, #5a1a3a, #a83a6a);
}
html.theme-lich .card,
html.theme-lich .queue-row,
html.theme-lich #inspect,
html.theme-lich #menu {
  background: rgba(24, 18, 32, 0.95);
  border-color: #3a2e46;
}
html.theme-lich .chip {
  background: #241c2e;
  border: 1px solid #33283f;
}
html.theme-lich button,
html.theme-lich .place,
html.theme-lich .tab,
html.theme-lich #tabs button {
  background: var(--btn);
  border-color: #0a080c;
  color: var(--text);
}
html.theme-lich .place.on,
html.theme-lich .tab.on,
html.theme-lich #tabs button.on,
html.theme-lich button.primary {
  background: var(--btn-on);
  border-color: #8ad070;
  box-shadow: 0 0 8px rgba(138, 208, 112, 0.45);
}
html.theme-lich .tab-fill {
  background: linear-gradient(#5a9a48, #2f5a28);
}
html.theme-lich .hint,
html.theme-lich .empty {
  color: #8f9c82;
}
html.theme-lich .shop-coins {
  color: #b8e8a0;
}
/* the town's cards: the prompt, the away report, the notices, the tooltip, a person's card */
html.theme-lich #prompt,
html.theme-lich #away,
html.theme-lich .toast,
html.theme-lich #tip,
html.theme-lich #person-card,
html.theme-lich #banner,
html.theme-lich #exp-header {
  background: rgba(20, 14, 26, 0.94);
  border-color: #4f6b3a;
  color: var(--text);
  box-shadow: 0 0 10px rgba(111, 208, 106, 0.18);
}
html.theme-lich .meter-fill {
  background: linear-gradient(90deg, #3f7a34, #9ae070);
}
/* the shop's and tavern's insides dim a little too */
html.theme-lich .shop-floor {
  filter: saturate(0.7) hue-rotate(-12deg) brightness(0.9);
}
/* the town: drained of colour, under a grave-dark vignette */
html.theme-lich.page-strip canvas {
  filter: saturate(0.5) hue-rotate(-18deg) brightness(0.88) contrast(1.08);
}
html.theme-lich.page-strip body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background: radial-gradient(ellipse at 50% 60%, transparent 45%, rgba(18, 4, 28, 0.55) 100%);
}
`;
