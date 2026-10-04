// The phone (web) version's page. It owns the game (mobileBridge) and shows the desktop strip and panel pages
// in two frames: the town strip along the bottom, scaled up for fingers, and the menus in a sheet above it.
// Everything the desktop tray does (new town, music, zoom) lives in the ☰ menu.

import { startFeed } from './feed';
import { PANELS, type StripState } from '../../shared/ipc';
import { mobileBridge } from './mobileBridge';
import { expeditionFill, researchFill } from '../../shared/format';
import { css, mix, skyColors, weatherCover } from '../town/skyColors';
import { applyTheme, panelLabel } from '../theme';

/** A phone on its side (the same test as the page's CSS): the tabs run across the top, and the town fills the
 *  rest of the screen under them. */
const sideways = matchMedia('(orientation: landscape) and (max-height: 560px)');
type Orientation = 'upright' | 'sideways';
const orientation = (): Orientation => (sideways.matches ? 'sideways' : 'upright');

/** How big the town is drawn (1 = the desktop strip's own size), zoomed out by default to see more of it. Upright
 *  and on its side are kept apart: on its side the height goes to sky as it zooms out, so it starts less far out.
 *  (New keys: the old one held the earlier, bigger sizes.) */
// (new keys again: the top-down town is seen from further out than the strip was)
const ZOOM_KEYS: Record<Orientation, string> = { upright: 'littletown.zoom4', sideways: 'littletown.zoom4.side' };
const DEFAULT_ZOOMS: Record<Orientation, number> = { upright: 0.5, sideways: 0.5 };
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.6;
/** Upright, the town takes this share of the height between the title bar and the tabs (the feed has the rest). */
const UPRIGHT_TOWN = 0.55;

const bridge = mobileBridge();
window.bridge = bridge;

const $ = (id: string) => document.getElementById(id)!;
const stripBox = $('strip-box');
const sheet = $('sheet');
const menu = $('menu');

const loadZoom = (o: Orientation): number => {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEYS[o]));
    return z >= MIN_ZOOM && z <= MAX_ZOOM ? z : DEFAULT_ZOOMS[o];
  } catch {
    return DEFAULT_ZOOMS[o];
  }
};
let zoom = loadZoom(orientation());

// The frames are made only now that the bridge is in place for them to find.
const strip = document.createElement('iframe');
strip.src = 'strip.html';
strip.title = 'Town';
stripBox.append(strip);
// (the first load takes a few seconds on a phone: the sprites are all inside renderer.js)
const loading = setInterval(() => {
  if (!strip.contentDocument?.querySelector('canvas')) return;
  clearInterval(loading);
  $('loading').remove();
}, 250);
const panel = document.createElement('iframe');
panel.src = 'panel.html';
panel.title = 'Menu';
sheet.append(panel);

/**
 * The strip is drawn at its desktop scale times the zoom, so zooming out fits more of the town across the screen
 * (smaller). Upright it's the desktop strip's height at that scale; on its side it fills all the height under the
 * tabs, the town along the bottom and more sky over it the further out it's zoomed. The clock bar and cards in the
 * strip are scaled back up, so they stay readable however far out it goes.
 */
/** A raid's battle, or a party's fight, is on screen (the map has all of it); a fight is drawn at its own scale. */
let battleOn = false;
let watchOn = false;

function layout(): void {
  const free = window.innerHeight - $('tabs').offsetHeight - (sideways.matches ? 0 : $('top').offsetHeight);
  // (upright, the town has the lower part and the feed the rest; on its side, everything under the tabs)
  // (in a battle the map has all of it, the feed hidden; watching a party's fight too, drawn at its own scale)
  const room = sideways.matches || battleOn ? free : Math.round(free * UPRIGHT_TOWN);
  // (the top-down town fills its room at the zoom, a raid's battle on it; a party's fight is drawn at its own scale)
  const fit = watchOn ? 1 : zoom;
  // (snapped so each pixel of the art is a whole number of the screen's pixels: even, sharp squares)
  const dpr = window.devicePixelRatio || 1;
  // (and, where it costs little, an even number: the art has detail on a grid twice as fine, pixelArt.ts FINE)
  // (below two of the screen's pixels the steps would be a doubling, so halves are allowed there)
  const steps = fit * dpr + 0.01;
  const whole = steps < 2 ? Math.max(1, Math.floor(steps * 2) / 2) : Math.floor(steps);
  const even = Math.floor(whole / 2) * 2;
  const z = (even >= 2 && even >= whole * 0.75 ? even : whole) / dpr;
  // (it fills its room, the town along the bottom and sky over it)
  const height = room / z;
  strip.style.width = `${stripBox.clientWidth / z}px`;
  strip.style.height = `${height}px`;
  strip.style.transform = `scale(${z})`;
  // (and the strip draws at that scale, rather than being stretched to it)
  const win = strip.contentWindow as (Window & { __stripScale?: number; __setStripScale?: (z: number) => void }) | null;
  if (win) {
    win.__stripScale = z;
    win.__setStripScale?.(z);
  }
  document.documentElement.style.setProperty('--strip-h', `${height * z}px`);
  strip.contentDocument?.documentElement?.style.setProperty('--ui-zoom', String(Math.max(1, 1 / z)));
  // (while the feed is showing, its cards carry the news: the strip's own pop-up notices would only repeat them)
  strip.contentDocument?.body?.classList.toggle('feed-shown', !sideways.matches && !battleOn);
}
function setZoom(z: number): void {
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  try {
    localStorage.setItem(ZOOM_KEYS[orientation()], String(zoom));
  } catch {}
  layout();
}
new ResizeObserver(layout).observe(stripBox);
window.addEventListener('resize', layout);
// turned on its side or back: that way's own zoom
sideways.addEventListener('change', () => {
  zoom = loadZoom(orientation());
  layout();
});
strip.addEventListener('load', layout); // (for the strip's --ui-zoom)
layout();

// Two fingers pinching the town zoom it (the strip reports the pinch; the zooming happens here). While the fingers
// are down the strip is only scaled on the screen (a CSS transform about the point between them: cheap and smooth);
// when they lift it is laid out again at the new zoom, drawn sharp, and its view moved so what was under the fingers
// stays there. The strip measures the fingers in its own pixels, which shrink and grow with the scale it's shown at,
// so they're turned into screen pixels by that scale.
let pinch: { zoom: number; z: number; screen: number; mx: number; my: number; shown: number } | null = null;
bridge.onPinch?.((phase, spread, mx, my) => {
  if (phase === 'start') {
    const z = parseFloat(strip.style.transform.replace('scale(', '')) || zoom; // (what the strip is shown at now)
    pinch = { zoom, z, screen: spread * z, mx, my, shown: z };
    stripBox.classList.add('pinching'); // (the strip, scaled past its box, is clipped to it)
  } else if (phase === 'move') {
    if (!pinch) return;
    // (the fingers' spread on the screen, against where they began: how much to zoom by)
    const k = Math.min(MAX_ZOOM / pinch.zoom, Math.max(MIN_ZOOM / pinch.zoom, (spread * pinch.shown) / pinch.screen));
    pinch.shown = pinch.z * k;
    // (the point between the fingers stays put: the strip grows about it)
    const sx = pinch.mx * pinch.z;
    const sy = pinch.my * pinch.z;
    strip.style.transform = `translate(${sx * (1 - k)}px, ${sy * (1 - k)}px) scale(${pinch.shown})`;
    zoom = pinch.zoom * k;
  } else {
    if (!pinch) return;
    const { mx, my, z } = pinch;
    pinch = null;
    stripBox.classList.remove('pinching');
    setZoom(zoom); // (laid out again, sharp, and saved)
    const now = parseFloat(strip.style.transform.replace('scale(', '')) || zoom;
    (strip.contentWindow as (Window & { __zoomAbout?: (mx: number, my: number, from: number, to: number) => void }) | null)?.__zoomAbout?.(mx, my, z, now);
  }
});

/* ------------------------------------------------------------ the tab bar (the desktop strip's dock) */

const tabs = $('tabs');
// (the Research button fills up as the topic being studied is learned, the Expeditions button as the party due
// home soonest makes its way, like the desktop dock's)
const fillBar = (cls: string) => {
  const bar = document.createElement('span');
  bar.className = cls;
  bar.hidden = true;
  return { bar, pct: -1 };
};
const fills = new Map([
  ['research', fillBar('tab-fill')],
  ['expeditions', fillBar('tab-fill trip')],
]);
/** Upright, the tabs are one slim row along the bottom: a mark over a short name. */
const TAB_ICONS: Record<string, string> = { build: '⚑', research: '✦', expeditions: '⛺', townsfolk: '☺', crafting: '⚒', trade: '⚖', journal: '✎' };
const SHORT_LABELS: Record<string, string> = { expeditions: 'Trips', townsfolk: 'Folk', crafting: 'Craft' };
const tabButtons = PANELS.map((p) => {
  const b = document.createElement('button');
  const fill = fills.get(p.id);
  if (fill) b.append(fill.bar);
  const icon = document.createElement('span');
  icon.className = 'tab-icon';
  icon.textContent = TAB_ICONS[p.id] ?? '•';
  const label = document.createElement('span');
  label.className = 'tab-label';
  label.textContent = p.label;
  label.dataset.short = SHORT_LABELS[p.id] ?? p.label;
  b.append(icon, label);
  b.addEventListener('click', () => bridge.togglePanel(p.id));
  tabs.append(b);
  return { id: p.id, b, label, name: p.label };
});
// the necropolis look, once the founder is a lich (and the menus' new names)
bridge.onSnapshot((snap) => {
  // (watching a party away takes the screen the same way)
  if (!!(snap.battle || snap.watch || snap.mine) !== battleOn || !!(snap.watch || snap.mine) !== watchOn) {
    battleOn = !!(snap.battle || snap.watch || snap.mine);
    watchOn = !!(snap.watch || snap.mine);
    document.body.classList.toggle('battle', battleOn);
    layout();
  }
});
bridge.onSnapshot((snap) => {
  if (!applyTheme(snap.theme, 'phone')) return;
  for (const t of tabButtons) {
    t.label.textContent = panelLabel(t.id, t.name, snap.theme);
    // (a look's own names where they fit the slim tabs; else the plain short name)
    const short = SHORT_LABELS[t.id] ?? t.name;
    t.label.dataset.short = t.label.textContent.length <= 9 ? t.label.textContent : short;
  }
  $('top-title').textContent = snap.origin.town;
  document.title = snap.origin.town;
});
// The page above the strip is more of the same sky, a little deeper toward the top of the screen.
let skyKey = '';
bridge.onSnapshot((snap) => {
  const c = snap.calendar;
  const { top } = skyColors(c.hour + c.minute / 60, c.daylight, weatherCover(snap.weather));
  const key = css(top);
  if (key === skyKey) return;
  skyKey = key;
  document.body.style.background = `linear-gradient(${css(mix(top, 0x05070f, 0.35))}, ${key})`;
});

bridge.onSnapshot((snap) => {
  for (const [id, f] of fills) {
    const now = id === 'research' ? researchFill(snap.research) : expeditionFill(snap.expeditions);
    if ((now?.pct ?? -1) === f.pct) continue;
    f.pct = now?.pct ?? -1;
    f.bar.hidden = !now;
    f.bar.style.width = `${Math.max(0, f.pct)}%`;
  }
});
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--tabs-h', `${tabs.offsetHeight}px`);
  layout();
}).observe(tabs);

const applyState = (s: StripState) => {
  sheet.hidden = !s.panel;
  document.body.classList.toggle('menu-open', !!s.panel); // (menus take the whole screen)
  if (s.panel) menu.hidden = true;
  for (const t of tabButtons) t.b.classList.toggle('on', t.id === s.panel);
};
bridge.onState(applyState);
void bridge.getState().then(applyState); // (a first run opens on the New town panel)

/* ------------------------------------------------------------ the feed (upright) */

startFeed($('feed'), bridge, strip);

/* ------------------------------------------------------------ the selected thing's card */

// Tapping in the town selects rather than acts; the strip sends what's selected here, with its buttons (marking a
// tree or rock for gathering is confirmed here).
const inspect = $('inspect');
bridge.onInspect?.((info) => {
  inspect.hidden = !info;
  $('hint').hidden = !!info;
  if (!info) return inspect.replaceChildren();
  const top = document.createElement('div');
  top.className = 'inspect-top';
  const title = document.createElement('span');
  title.className = 'inspect-title';
  title.textContent = info.title;
  const close = document.createElement('button');
  close.className = 'inspect-close';
  close.textContent = '✕';
  close.addEventListener('click', () => bridge.inspectAction?.('close'));
  top.append(title, close);
  const lines = document.createElement('div');
  lines.className = 'inspect-lines';
  lines.textContent = info.lines.join(' · ');
  const actions = document.createElement('div');
  actions.className = 'inspect-actions';
  for (const a of info.actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.primary) b.className = 'primary';
    if (a.danger) b.className = 'danger';
    b.addEventListener('click', () => bridge.inspectAction?.(a.id));
    actions.append(b);
  }
  inspect.replaceChildren(top, lines, ...(info.actions.length ? [actions] : []));
});

/* ------------------------------------------------------------ the ☰ menu */

function drawMenu(): void {
  void bridge.getState().then((s) => {
    const item = (label: string, onClick: () => void, on = false) => {
      const b = document.createElement('button');
      b.className = on ? 'item on' : 'item';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    const zooms = document.createElement('div');
    zooms.className = 'zooms';
    const step = (by: number) => () => {
      setZoom(zoom * by);
      drawMenu();
    };
    zooms.append(item('− Out', step(1 / 1.2)), item(`${Math.round(zoom * 100)}%`, () => (setZoom(DEFAULT_ZOOMS[orientation()]), drawMenu())), item('In +', step(1.2)));
    const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    menu.replaceChildren(
      item('New town…', () => bridge.openPanel('newgame')),
      item(`Music: ${s.music ? 'on' : 'off'}`, () => (bridge.setMusic(!s.music), drawMenu())),
      item('Phone alerts…', () => bridge.openPanel('alerts')),
      label('Zoom (or pinch the town with two fingers; tap the % to reset)'),
      zooms,
      ...(installed ? [] : [label('To install: Chrome menu ⋮ → Add to Home screen')]),
    );
  });
}
function label(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'label';
  d.textContent = text;
  return d;
}
$('menu-btn').addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  if (!menu.hidden) drawMenu();
});
// (a tap in one of the frames doesn't reach this page, but it does take the focus away)
window.addEventListener('blur', () => (menu.hidden = true));
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !(e.target instanceof Node && (menu.contains(e.target) || $('menu-btn').contains(e.target)))) menu.hidden = true;
});

/* ------------------------------------------------------------ offline */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('[mobile] no offline support:', err));
}
