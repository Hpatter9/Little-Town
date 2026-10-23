// The phone (web) version's page. It owns the game (mobileBridge) and shows the desktop strip and panel pages
// in two frames: the town strip along the bottom, scaled up for fingers, and the menus in a sheet above it.
// Everything the desktop tray does (new town, music, zoom) lives in the ☰ menu.

import { applyGivenNames } from '../art/givenNames';
import { readLevel, saveLevel, type VolumeKind } from '../volume';
import { readVibrate, saveVibrate } from '../vibration';
import { startNotices } from './notices';
import { startStoresReadout } from './storesReadout';
import { createBeastAsk } from '../overlayUi';
import { watchFavourites } from './obituaryReveal';
import { createEventSheet } from './eventSheet';
import { startPopupHold } from './popupHold';
import { startWaitingChoices } from './waitingChoices';
import { revealsOn, setItemOpener, setRevealsOn, showReveal, startReveals } from './revealCard';
import { openCardInMenu, setMenuFrame } from './cardLink';
import { buildingCard, buildingCardKey, type BuildingArt } from '../panel/buildingCard';
import { PANELS, type PanelId, type StripState } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { mobileBridge } from './mobileBridge';
import { expeditionFill, researchFill } from '../../shared/format';
import { css, mix, skyColors, weatherCover } from '../town/skyColors';
import { applyTheme, panelLabel } from '../theme';
import { setTipsOn, tipsOn } from './tips';
import { createTutorial } from './tutorial';
import { tutorialPending } from './tutorialSteps';
import { applyUiLook } from '../ui/frame';
import { wireTips } from '../ui/tips';
import { createTopBar } from '../ui/topBar';
import { startUndergroundSwitch } from './undergroundSwitch';
import { watchMilestones } from './milestoneCards';
import type { LoadingHost } from './loading';
import { townSketch } from '../loading/sketch';
import { reduceMotionSet, setReduceMotion } from '../ui/motion';

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
const bridge = mobileBridge();
window.bridge = bridge;

/* ------------------------------------------------------------ the loading screen (mobile/loading.ts) */

/** What the main menu's Continue shows of the town. */
const summaryOf = (snap: Snapshot) => ({ name: snap.townName, people: snap.people.length, day: snap.calendar.day, season: snap.calendar.season });

// (its own script, up first: this page tells it what has come, and it says when it has gone, when the game's clock,
// held till then, runs; no screen at all, and the clock runs at once)
{
  const loading = (window as unknown as { __loading?: LoadingHost }).__loading;
  loading?.got('page');
  void bridge.getSnapshot().then((snap) => {
    loading?.summary(summaryOf(snap));
    loading?.town(townSketch(snap, window.innerWidth / Math.max(1, window.innerHeight)));
    loading?.got('town');
  });
  if (loading) loading.onReveal(() => bridge.release?.());
  else bridge.release?.();
  // (the main menu, up before any of this: its New game opens the founding flow and Settings the ☰ menu's settings)
  loading?.setActions({
    newGame: () => {
      loading.peek(true);
      bridge.openPanel('newgame');
    },
    settings: () => {
      document.body.classList.add('mm-settings');
      menu.hidden = false;
      drawMenu();
    },
    leaving: () => bridge.closePanel(),
  });
}

// Keep the town visible while its page is open on phones that support the Screen Wake Lock API. The browser releases
// the lock when the page is hidden; ask for it again when the player returns.
let screenWakeLock: WakeLockSentinel | null = null;
async function keepScreenAwake(): Promise<void> {
  if (document.visibilityState !== 'visible' || screenWakeLock || !('wakeLock' in navigator)) return;
  try {
    screenWakeLock = await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release', () => {
      screenWakeLock = null;
    });
  } catch {
    // (unsupported browsers and system power settings may refuse the request)
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void keepScreenAwake();
  else screenWakeLock = null;
});
void keepScreenAwake();

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
setMenuFrame(panel);

/**
 * The strip is drawn at its desktop scale times the zoom, so zooming out fits more of the town across the screen
 * (smaller). Upright it's the desktop strip's height at that scale; on its side it fills all the height under the
 * tabs, the town along the bottom and more sky over it the further out it's zoomed. The clock bar and cards in the
 * strip are scaled back up, so they stay readable however far out it goes.
 */
/** A raid's battle, or a party's fight, is on screen (the map has all of it); a fight is drawn at its own scale. */
let battleOn = false;
let watchOn = false;
/** How near (a share) the zoom must come to a whole step of the screen's pixels to be snapped onto it. */
const SNAP_NEAR = 0.04;

function layout(): void {
  // (the title bar's height, for what hangs from it in the CSS: the ☰ menu and the news feed)
  document.documentElement.style.setProperty('--top-h', `${$('top').offsetHeight}px`);
  const free = window.innerHeight - $('tabs').offsetHeight - (sideways.matches ? 0 : $('top').offsetHeight);
  // (the town has all the room under the title bar and over the tabs; the news is a bubble over it: notices.ts)
  const room = free;
  // (the top-down town fills its room at the zoom, a raid's battle on it; a party's fight is drawn at its own scale)
  const fit = watchOn ? 1 : zoom;
  // (the zoom as asked, so a pinch or the slider moves it smoothly; only when it comes close to a whole number of the
  // screen's pixels to an art pixel (halves below two) is it snapped there, for sharp squares. It was always snapped,
  // so the zoom jumped between a few steps and most of a pinch did nothing: the owner's "sluggish and choppy")
  const dpr = window.devicePixelRatio || 1;
  const steps = fit * dpr;
  const near = steps < 2 ? Math.max(0.5, Math.round(steps * 2) / 2) : Math.round(steps);
  const z = (Math.abs(near - steps) <= steps * SNAP_NEAR ? near : steps) / dpr;
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
  strip.contentDocument?.documentElement?.style.setProperty('--ui-zoom', String(1 / z));
  // (the news bubble carries the news: the strip's own pop-up notices would only repeat them, so it pops only the
  // day's small change; the class keeps its old name)
  strip.contentDocument?.body?.classList.toggle('feed-shown', !battleOn);
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
// are down only the map's canvas inside the strip is scaled (a CSS transform about the point between them: cheap and
// smooth), so the clock bar and the other overlays over the map stay as they are; when the fingers lift the strip is
// laid out again at the new zoom, drawn sharp, and its view moved so what was under the fingers stays there. The strip
// measures the fingers in its own pixels, which is what the canvas's transform is in too.
let pinch: { zoom: number; z: number; screen: number; mx: number; my: number; nx: number; ny: number; k: number } | null = null;
let pinchFrame = 0;
const mapCanvas = () => strip.contentDocument?.querySelector('body > canvas') as HTMLCanvasElement | null;
type StripWin = Window & {
  __zoomAbout?: (mx: number, my: number, from: number, to: number, nx?: number, ny?: number) => void;
  __pinching?: (on: boolean) => void;
  __picture?: (h: { person?: number; building?: string }) => HTMLCanvasElement | null;
};
const stripWin = () => strip.contentWindow as StripWin | null;
// (the canvas follows the fingers once a frame, however many moves the touch screen reports between)
const showPinch = () => {
  pinchFrame = 0;
  const c = mapCanvas();
  if (!pinch || !c) return;
  const { k, mx, my, nx, ny } = pinch;
  // (what was under the fingers when they came down stays under them: the map grows about that point and goes with
  // the fingers as they move together, so two fingers pan as they zoom)
  c.style.transform = `translate(${nx - mx * k}px, ${ny - my * k}px) scale(${k})`;
};
bridge.onPinch?.((phase, spread, mx, my) => {
  if (phase === 'start') {
    const z = parseFloat(strip.style.transform.replace('scale(', '')) || zoom; // (what the strip is shown at now)
    pinch = { zoom, z, screen: spread, mx, my, nx: mx, ny: my, k: 1 };
    const c = mapCanvas();
    if (c) {
      c.style.transformOrigin = '0 0';
      c.style.willChange = 'transform';
    }
    // (the strip stops drawing while the fingers are down: the canvas is only moved and scaled, so the page has the
    // whole of each frame for it and it keeps up with the fingers)
    stripWin()?.__pinching?.(true);
  } else if (phase === 'move') {
    if (!pinch) return;
    // (the fingers' spread against where they began: how much to zoom by)
    pinch.k = Math.min(MAX_ZOOM / pinch.zoom, Math.max(MIN_ZOOM / pinch.zoom, spread / pinch.screen));
    pinch.nx = mx;
    pinch.ny = my;
    zoom = pinch.zoom * pinch.k;
    if (!pinchFrame) pinchFrame = requestAnimationFrame(showPinch);
  } else {
    if (!pinch) return;
    const { mx, my, nx, ny, z } = pinch;
    pinch = null;
    if (pinchFrame) cancelAnimationFrame(pinchFrame);
    pinchFrame = 0;
    const c = mapCanvas();
    if (c) {
      c.style.transform = '';
      c.style.willChange = '';
    }
    setZoom(zoom); // (laid out again, sharp, and saved)
    const now = parseFloat(strip.style.transform.replace('scale(', '')) || zoom;
    stripWin()?.__zoomAbout?.(mx, my, z, now, nx, ny);
    stripWin()?.__pinching?.(false);
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
const TAB_ICONS: Record<string, string> = { dev: '⚙', build: '⌂', research: '✦', expeditions: '⛺', townsfolk: '☺', trade: '⚖', war: '⚔', journal: '✎' };
const SHORT_LABELS: Record<string, string> = { journal: 'Annals' };
const makeTab = (p: { id: PanelId; label: string }) => {
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
  b.dataset.panel = p.id; // (the tutorial points at a tab by it)
  b.addEventListener('click', () => bridge.togglePanel(p.id));
  tabs.append(b);
  return { id: p.id, b, label, name: p.label };
};
const tabButtons = PANELS.map(makeTab);

/* ------------------------------------------------------------ developer mode (sim/dev.ts, panel/devPanel.ts) */

// (the owner's ask: a Developer mode switch in the ☰ menu, kept per device; while it's on the town takes developer
// orders, the Dev tab is shown and a DEV mark sits in the corner, so it's never mistaken for normal play)
const DEV_KEY = 'littletown.dev';
function devOn(): boolean {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}
const devTab = makeTab({ id: 'dev', label: 'Dev' });
tabButtons.push(devTab);
const devMark = document.createElement('div');
devMark.id = 'dev-mark';
devMark.textContent = 'DEV';
devMark.style.cssText = 'position:fixed;left:env(safe-area-inset-left, 0px);top:50%;transform:translateY(-50%);z-index:60;pointer-events:none;padding:6px 3px;border-radius:0 4px 4px 0;background:#c0392b;color:#fff;font:bold 10px/1.1 system-ui,sans-serif;writing-mode:vertical-rl;letter-spacing:2px;opacity:0.85';
document.body.append(devMark);
/** Show or hide the Dev tab and the mark; the tab bar takes one more column while the Dev tab is on it. */
function showDev(on: boolean): void {
  devTab.b.hidden = !on;
  devMark.hidden = !on;
  tabs.style.gridTemplateColumns = on ? `repeat(${tabButtons.filter((t) => !t.b.hidden).length}, 1fr)` : '';
}
showDev(devOn());
/** When the town was last asked to match the device's switch (it may refuse: an ironman town). */
let devAskedAt = 0;
function setDev(on: boolean): void {
  try {
    localStorage.setItem(DEV_KEY, on ? '1' : '0');
  } catch {}
  showDev(on);
  layout();
  devAskedAt = Date.now();
  bridge.command?.({ type: 'devMode', on });
  if (!on && document.body.classList.contains('menu-open')) bridge.closePanel();
}
// (the town follows the device: a town loaded or begun here with the switch on is put in developer mode, and one
// played here with it off is taken out of it)
bridge.onSnapshot((snap) => {
  const want = devOn();
  if (want === !!snap.dev || (want && snap.ironman) || Date.now() - devAskedAt < 5000) return;
  devAskedAt = Date.now();
  bridge.command?.({ type: 'devMode', on: want });
});
// a choice event takes the whole screen (eventSheet.ts)
{
  startPopupHold(bridge, [() => !!(strip.contentWindow as (Window & { __cardUp?: () => boolean }) | null)?.__cardUp?.()]);
  const sheet = createEventSheet((prompt, option) => bridge.command?.({ type: 'answerPrompt', prompt, option }), strip, (n, name) => bridge.command?.({ type: 'name', kind: n.kind, id: n.id, name }), (prompt) => bridge.command?.({ type: 'parkPrompt', prompt }));
  bridge.onSnapshot((snap) => (applyGivenNames(snap), sheet.update(snap)));
  document.body.append(startWaitingChoices(bridge)); // (a closed choice waits behind this button: waitingChoices.ts)
}
// the first-town tutorial (tutorial.ts): a new town is shown it once, when its loading screen has gone; ☰ Settings replays it
const tutorial = createTutorial({ bridge, strip, zoom: () => zoom });
{
  const loadingHost = (window as unknown as { __loading?: LoadingHost }).__loading;
  const startIfNew = () => tutorialPending(localStorage) && window.setTimeout(tutorial.start, 600);
  if (loadingHost) loadingHost.onReveal(startIfNew);
  else startIfNew();
}
// the rare things, and a party's haul, revealed card by card (revealCard.ts)
startReveals(bridge, strip);
(window as unknown as { __reveal?: typeof showReveal }).__reveal = showReveal; // (for previews)
// (a thing's card, opened in the menus from this page: a unique on its reveal card or in a haul, a news line's "About
// it": panel/infoCard.ts)
setItemOpener((id) => openCardInMenu({ kind: 'item', id }, 'journal'));
// the necropolis look, once the founder is a lich (and the menus' new names)
bridge.onSnapshot((snap) => {
  // (watching a party away takes the screen the same way)
  // (a tactics battle too, drawn at its own scale like a watched fight)
  // (and a cutscene playing: the whole screen, like a watched fight)
  const scene = !!snap.scene?.playing;
  // (and the Deep looked into)
  const below = !!snap.deepView || !!snap.underView || !!snap.portalView || !!snap.interior;
  if (scene !== document.body.classList.contains('scene') || !!(snap.battle || snap.watch || snap.mine || below || snap.tactics || scene) !== battleOn || !!(snap.watch || snap.mine || below || snap.tactics || scene) !== watchOn) {
    battleOn = !!(snap.battle || snap.watch || snap.mine || below || snap.tactics || scene);
    watchOn = !!(snap.watch || snap.mine || below || snap.tactics || scene);
    document.body.classList.toggle('battle', battleOn);
    document.body.classList.toggle('scene', scene);
    layout();
  }
});
// the shared look (ui/): the people's frames, the alignment's warmth and the night; the quiet top bar; held tips
const topBar = createTopBar($('top'), bridge);
startUndergroundSwitch(bridge, $('top')); // (Surface / Underground: mobile/undergroundSwitch.ts)
wireTips();
watchMilestones(bridge); // (the rank's changes and the town's firsts, each told once as a card)
bridge.onSnapshot((snap) => {
  applyUiLook('phone', snap.theme, snap.align?.cast ?? 0, snap.calendar.daylight);
  topBar.update(snap);
});
bridge.onSnapshot((snap) => {
  if (!applyTheme(snap.theme, 'phone')) return;
  for (const t of tabButtons) {
    t.label.textContent = panelLabel(t.id, t.name, snap.theme);
    // (a look's own names where they fit the slim tabs; else the plain short name)
    const short = SHORT_LABELS[t.id] ?? t.name;
    t.label.dataset.short = t.label.textContent.length <= 8 ? t.label.textContent : short; // (six tabs upright: a long name is cut)
  }
  // (the top bar writes the town's name and rank: ui/topBar.ts)
  document.title = snap.townName;
});
// The page above the strip is more of the same sky, a little deeper toward the top of the screen.
let skyKey = '';
bridge.onSnapshot((snap) => {
  const c = snap.calendar;
  const cast = snap.align?.cast ?? 0;
  // (the town's alignment tints the sky a little: a cold violet-red for the dark, a warm gold for the light)
  const sky = skyColors(c.hour + c.minute / 60, c.daylight, weatherCover(snap.weather)).top;
  const top = mix(sky, cast < 0 ? 0x5a1a30 : 0xf0d890, Math.abs(cast) * 0.18);
  // (and a soft vignette at the edges of the screen, never over the middle: the land stays readable)
  const veil = document.getElementById('align-cast');
  if (veil) veil.style.background = Math.abs(cast) < 0.15 ? 'none' : `radial-gradient(ellipse at center, transparent 62%, ${cast < 0 ? `rgba(60, 10, 30, ${(Math.abs(cast) * 0.3).toFixed(2)})` : `rgba(255, 224, 140, ${(cast * 0.22).toFixed(2)})`} 100%)`;
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

// The game waits while a menu is open (the owner's ask): opening one pauses the town unless the player had paused it
// already, and closing it lets the town run again. Pressing ▶ inside the menu is the player's own call and is kept.
let heldByMenu: 'wait' | 'on' | null = null;
let townPaused = false;
bridge.onSnapshot((snap) => {
  townPaused = snap.paused;
  if (heldByMenu === 'wait' && snap.paused) heldByMenu = 'on';
  else if (heldByMenu === 'on' && !snap.paused) heldByMenu = null;
});
const holdForMenu = (open: boolean) => {
  if (open && !heldByMenu && !townPaused) {
    heldByMenu = 'wait';
    bridge.command?.({ type: 'setPaused', paused: true });
  } else if (!open && heldByMenu) {
    heldByMenu = null;
    bridge.command?.({ type: 'setPaused', paused: false });
  }
};

const applyState = (s: StripState) => {
  holdForMenu(!!s.panel && s.panel !== 'newgame');
  sheet.hidden = !s.panel;
  document.body.classList.toggle('menu-open', !!s.panel); // (menus take the whole screen)
  if (s.panel) menu.hidden = true;
  for (const t of tabButtons) t.b.classList.toggle('on', t.id === s.panel);
  // (the founding panel opened from the main menu was closed unfounded: back to the menu)
  const loading = (window as unknown as { __loading?: LoadingHost }).__loading;
  if (!s.panel && loading?.peeking) loading.peek(false);
};
bridge.onState(applyState);
void bridge.getState().then(applyState); // (a first run opens on the New town panel)

/* ------------------------------------------------------------ the news bubble */

// (the owner's ask: no feed over the town; a bubble at the right while there's news not yet looked at, coloured by
// the worst of it, opening a page to review it and act: notices.ts)
{
  const { bubble, sheet: news } = startNotices(bridge, strip);
  document.body.append(bubble, news);
}

// (the owner's ask: the town's coins and main materials at the top right; a tap opens the Town menu's Stores tab)
document.body.append(startStoresReadout(bridge));
// the great creature's Praise or Scold for its last deed (sim/creature.ts): a small card that never holds the town
const beastAsk = createBeastAsk((praise) => bridge.command?.({ type: 'creature', op: praise ? 'praise' : 'scold' }));
// (it stands aside while a tap card is up: the creature's own card has Praise and Scold too)
bridge.onSnapshot((snap) => (snap.creature?.ask && document.getElementById('inspect')?.hidden !== false ? beastAsk.show(snap.creature.ask.id, snap.creature.ask.text) : beastAsk.hide()));

// (a favourite's death: their obituary card, once: mobile/obituaryReveal.ts)
bridge.onSnapshot(watchFavourites(strip));

/* ------------------------------------------------------------ the selected thing's card */

// Tapping in the town selects rather than acts; the strip sends what's selected here, with its buttons (marking a
// tree or rock for gathering is confirmed here).
const inspect = $('inspect');
// (a selected building shows its card: panel/buildingCard.ts, kept up to date as the town moves on)
let cardFor: number | null = null;
let cardKey = '';
let cardLines: HTMLElement | null = null;
let lastSnap: Parameters<Parameters<typeof bridge.onSnapshot>[0]>[0] | null = null;
const cardSlot = document.createElement('div');
cardSlot.className = 'inspect-card';
const cardArt: BuildingArt = { building: (def) => stripWin()?.__picture?.({ building: def }) ?? null, person: (id) => stripWin()?.__picture?.({ person: id }) ?? null };
const drawCard = () => {
  if (cardFor === null || !lastSnap) return;
  const key = buildingCardKey(lastSnap, cardFor);
  if (key === cardKey) return;
  cardKey = key;
  const card = buildingCard(lastSnap, cardFor, cardArt, (name) => bridge.command?.({ type: 'name', kind: 'building', id: cardFor!, name }));
  cardSlot.replaceChildren(...(card ? [card] : []));
  if (cardLines) cardLines.hidden = !!card;
};
bridge.onSnapshot((snap) => {
  lastSnap = snap;
  drawCard();
});
bridge.onInspect?.((info) => {
  inspect.hidden = !info;
  $('hint').hidden = !!info;
  cardFor = info?.building ?? null;
  cardKey = '';
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
  cardLines = lines;
  cardSlot.replaceChildren();
  inspect.replaceChildren(top, lines, ...(cardFor !== null ? [cardSlot] : []), ...(info.actions.length ? [actions] : []));
  drawCard();
});

/* ------------------------------------------------------------ the ☰ menu */

// (set by tools/build-web.mjs: the package's version, the commit and the day it was built)
declare const __GAME_VERSION__: string;
declare const __GAME_COMMIT__: string;
declare const __GAME_BUILT__: string;
const gameVersion = (): string => {
  const v = typeof __GAME_VERSION__ === 'string' ? __GAME_VERSION__ : '?';
  const commit = typeof __GAME_COMMIT__ === 'string' && __GAME_COMMIT__ ? ` · ${__GAME_COMMIT__}` : '';
  const built = typeof __GAME_BUILT__ === 'string' ? ` · built ${__GAME_BUILT__}` : '';
  return `Version ${v}${commit}${built}`;
};

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
    zooms.className = 'zoom-control';
    const zoomLabel = document.createElement('span');
    const zoomInput = document.createElement('input');
    zoomInput.type = 'range';
    zoomInput.min = String(Math.round(MIN_ZOOM * 100));
    zoomInput.max = String(Math.round(MAX_ZOOM * 100));
    zoomInput.step = '1';
    zoomInput.value = String(Math.round(zoom * 100));
    zoomInput.setAttribute('aria-label', 'Map zoom');
    let zoomStart: number | null = null;
    const startZoomPreview = () => {
      if (zoomStart !== null) return;
      zoomStart = zoom;
      const canvas = mapCanvas();
      if (canvas) canvas.style.transformOrigin = '50% 50%';
      stripBox.classList.add('pinching');
    };
    const previewZoom = () => {
      startZoomPreview();
      const scale = (Number(zoomInput.value) / 100) / (zoomStart ?? zoom);
      const canvas = mapCanvas();
      if (canvas) canvas.style.transform = `scale(${scale})`;
    };
    const commitZoom = () => {
      if (zoomStart === null) return;
      const canvas = mapCanvas();
      if (canvas) canvas.style.transform = '';
      stripBox.classList.remove('pinching');
      zoomStart = null;
      setZoom(Number(zoomInput.value) / 100);
    };
    const showZoom = () => (zoomLabel.textContent = `Map zoom: ${zoomInput.value}% (or pinch with two fingers)`);
    showZoom();
    zoomInput.addEventListener('pointerdown', startZoomPreview);
    zoomInput.addEventListener('keydown', startZoomPreview);
    zoomInput.addEventListener('input', () => (previewZoom(), showZoom()));
    zoomInput.addEventListener('change', commitZoom);
    zoomInput.addEventListener('blur', commitZoom);
    zooms.append(zoomLabel, zoomInput, item('Reset zoom', () => (setZoom(DEFAULT_ZOOMS[orientation()]), drawMenu())));
    const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    // (the same list opens over the main menu from its Settings; what opens a panel waits for the game)
    const fromMenu = document.body.classList.contains('mm-settings');
    menu.replaceChildren(
      ...(fromMenu
        ? [item('Back to the main menu', () => (menu.hidden = true))]
        : [
            item('New town…', () => bridge.openPanel('newgame')),
            item('Main menu', () => {
              menu.hidden = true;
              const loading = (window as unknown as { __loading?: LoadingHost }).__loading;
              bridge.closePanel();
              void bridge.suspend?.().then(async () => {
                loading?.summary(summaryOf(await bridge.getSnapshot()));
                loading?.showMenu();
              });
            }),
          ]),
      label('Sound and feel'),
      item(`Music: ${s.music ? 'on' : 'off'}`, () => (bridge.setMusic(!s.music), drawMenu())),
      slider('music', 'Music volume'),
      slider('sfx', 'Sound effects volume'),
      // (the phone buzzes softly at the big moments: vibration.ts; its own setting, not the sound's)
      ...('vibrate' in navigator ? [item(`Vibration: ${readVibrate() ? 'on' : 'off'}`, () => (saveVibrate(!readVibrate()), drawMenu()))] : []),
      // (battle shake, hit-stop, zoom and slow-motion off: ui/motion.ts)
      item(`Reduce motion: ${reduceMotionSet() ? 'on' : 'off'}`, () => (setReduceMotion(!reduceMotionSet()), drawMenu())),
      label('Screen'),
      item(`Minimap: ${minimapShown() ? 'on' : 'off'}`, () => (setMinimap(!minimapShown()), drawMenu())),
      // (the loading screen's scene behind the logo, off for a slow phone: mobile/loading.ts)
      item(`Loading scene: ${loadingSceneOn() ? 'on' : 'off'}`, () => (setLoadingScene(!loadingSceneOn()), drawMenu())),
      zooms,
      label('Developer'),
      item(`Developer mode: ${devOn() ? 'on' : 'off'}`, () => (setDev(!devOn()), drawMenu()), devOn()),
      ...(devOn() && !fromMenu ? [item('Developer menu…', () => ((menu.hidden = true), bridge.openPanel('dev')))] : []),
      label('Help'),
      item(`Tips: ${tipsOn() ? 'on' : 'off'}`, () => (setTipsOn(!tipsOn()), drawMenu())),
      ...(fromMenu ? [] : [item('Replay the tutorial', () => ((menu.hidden = true), tutorial.start()))]),
      item(`Reveal cards: ${revealsOn() ? 'on' : 'off'}`, () => (setRevealsOn(!revealsOn()), drawMenu())),
      ...(fromMenu ? [] : [item('Phone alerts…', () => bridge.openPanel('alerts'))]),
      ...offlineLine(),
      ...(installed ? [] : [label('To install: Chrome menu ⋮ → Add to Home screen')]),
      version(),
    );
  });
}
/** A volume slider (the owner's ask): sets the strip's music or sound effects as it moves, and the phone remembers it
 *  (volume.ts). */
type VolumeWin = Window & { __volume?: Record<VolumeKind, number> };
function slider(kind: VolumeKind, name: string): HTMLElement {
  const row = document.createElement('label');
  row.className = 'volume';
  const text = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  const live = (strip.contentWindow as VolumeWin | null)?.__volume;
  const now = live ? live[kind] : readLevel(kind);
  input.value = String(Math.round(now * 100));
  const show = () => (text.textContent = `${name}: ${input.value}%`);
  show();
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    const vol = (strip.contentWindow as VolumeWin | null)?.__volume;
    if (vol) vol[kind] = v;
    saveLevel(kind, v);
    show();
  });
  row.append(text, input);
  return row;
}
/** The strip's minimap (map/minimap.ts), turned on and off from the ☰ menu (the owner's ask). */
type MinimapWin = Window & { __minimap?: { shown: boolean } };
function minimapShown(): boolean {
  const m = (strip.contentWindow as MinimapWin | null)?.__minimap;
  if (m) return m.shown;
  try {
    return localStorage.getItem('littletown.minimap') !== '0';
  } catch {
    return true;
  }
}
function setMinimap(on: boolean): void {
  const m = (strip.contentWindow as MinimapWin | null)?.__minimap;
  if (m) m.shown = on;
  else
    try {
      localStorage.setItem('littletown.minimap', on ? '1' : '0');
    } catch {}
}
/** The loading screen's scene (mobile/loading.ts reads the same key; kept apart so this page needn't bundle it). */
const SCENE_KEY = 'littletown.loadingScene';
function loadingSceneOn(): boolean {
  try {
    return localStorage.getItem(SCENE_KEY) !== '0';
  } catch {
    return true;
  }
}
function setLoadingScene(on: boolean): void {
  try {
    localStorage.setItem(SCENE_KEY, on ? '1' : '0');
  } catch {}
}
/** The version line at the foot of the menu. */
function version(): HTMLElement {
  const d = label(gameVersion());
  d.classList.add('version');
  return d;
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
// (shut, the ☰ menu is the game's own again)
new MutationObserver(() => menu.hidden && document.body.classList.remove('mm-settings')).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !(e.target instanceof Node && (menu.contains(e.target) || $('menu-btn').contains(e.target)))) menu.hidden = true;
});

/* ------------------------------------------------------------ offline */

// The service worker (sw.js) keeps the whole game on the phone. Once it is installed the page asks it to fetch the
// big art folders in the background, and shows how far it has got in the ☰ menu.
type OfflineState = { done: number; total: number; ready: boolean; downloading: boolean; failed?: boolean };
let offline: OfflineState | null = null;
let offlineSeen = -1;
const askWorker = (msg: string): void => {
  void navigator.serviceWorker.ready.then((r) => r.active?.postMessage(msg)).catch(() => {});
};
function offlineLine(): HTMLElement[] {
  if (!offline) return [];
  const row = label(offline.ready ? 'Ready to play offline ✓' : `Downloading for offline: ${Math.floor((offline.done / Math.max(1, offline.total)) * 100)}%`);
  if (offline.ready || offline.downloading) return [row];
  const b = document.createElement('button');
  b.className = 'item';
  b.textContent = 'Download now';
  b.addEventListener('click', () => (askWorker('offline-start'), drawMenu()));
  return [row, b];
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type !== 'offline-status') return;
    offline = e.data as OfflineState;
    if (!menu.hidden) drawMenu();
  });
  // (with no signal the register call fails, but the worker installed earlier is still there to ask)
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('[mobile] sw.js not checked:', err));
  void navigator.serviceWorker.ready.then(() => {
    askWorker('offline-start');
    // (a worker the phone put to sleep mid-download is woken again: resumable, so nothing is fetched twice)
    setInterval(() => {
      if (offline?.ready) return;
      const stuck = offline !== null && offline.done === offlineSeen && !offline.downloading;
      offlineSeen = offline?.done ?? -1;
      askWorker(stuck && navigator.onLine ? 'offline-start' : 'offline-status');
    }, 5000);
  });
}
