// The frame set (the owner's ask: menus that look better and more thought out, cut from the packs). Three sprites
// (ui/art, see CREDITS.md) are tinted for the people on a canvas and handed to the page as CSS variables, which the
// shared stylesheet (ui/uiCss.ts) lays round every menu, card, button, tab, chip, the event box, the news and the fight
// screen:
//
// - wood.png, the Craftpix medieval field-work window's carved frame (the settlers', the druids' birch, the fae's thorn),
// - stone.png, the Craftpix top-down dungeon's bevelled slab (every button's face; the rim of the stone peoples),
// - gui0.png, DawnLike's GUI sheet: the rounded chip (tabs, chips, a sheet's grip) and the rod (dividers).
//
// Each page (the menus, the phone's page, the strip) calls applyUiLook with every snapshot; only a change of people,
// alignment (in fifths) or night does any work. Tapping: every button is pressed while held (.ui-down) and clicks
// softly through the strip's sounds (ambience.ts 'page').

import type { ThemeId } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import { alignRamp, alignStep, disabledRamp, hexRgb, lightness, lookOf, nightDepth, pressedRamp, gradientMap, type Ramp } from './looks';
import { uiCss } from './uiCss';
import woodUrl from './art/wood.png';
import stoneUrl from './art/stone.png';
import guiUrl from './art/gui0.png';

export type UiPage = 'panel' | 'phone' | 'strip';

/** Where each piece is cut from its sheet, and its 9-slice. */
const PIECES = {
  wood: { url: woodUrl, x: 0, y: 0, w: 51, h: 57, cut: 9 },
  stone: { url: stoneUrl, x: 0, y: 0, w: 44, h: 48, cut: 6 },
  chip: { url: guiUrl, x: 128, y: 112, w: 16, h: 16, cut: 5 },
  rod: { url: guiUrl, x: 96, y: 1, w: 40, h: 14, cut: 8 },
} as const;
type Piece = keyof typeof PIECES;

const images = new Map<string, Promise<HTMLImageElement>>();
const image = (url: string) => {
  let p = images.get(url);
  if (!p) {
    p = loadImage(url);
    images.set(url, p);
  }
  return p;
};

/** A piece cut out and tinted by a ramp (null: as drawn), on a canvas. The rod is closed at its right end with its
 *  own left cap turned round, so a divider is the same at both ends. */
async function tinted(piece: Piece, ramp: Ramp | null): Promise<HTMLCanvasElement> {
  const p = PIECES[piece];
  const im = await image(p.url);
  const c = document.createElement('canvas');
  const w = piece === 'rod' ? p.w + 8 : p.w;
  c.width = w;
  c.height = p.h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(im, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
  if (piece === 'rod') {
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(im, p.x, p.y, 8, p.h, 0, 0, 8, p.h);
    g.restore();
  }
  if (ramp) {
    const data = g.getImageData(0, 0, w, p.h);
    gradientMap(data.data, ramp);
    g.putImageData(data, 0, 0);
  }
  return c;
}

/** The frame set as now tinted, for a canvas-drawn screen (ui/pixiFrame.ts: the raid board's boxes and buttons). */
const canvases = new Map<string, HTMLCanvasElement>();
let canvasVersion = 0;
export const frameCanvas = (kind: string): HTMLCanvasElement | null => canvases.get(kind) ?? null;
/** Goes up each time the frames are tinted afresh. */
export const frameVersion = (): number => canvasVersion;

/** Light writing on a dark face, dark on a light one. */
const textOn = (ramp: Ramp): string => {
  const [r, g, b] = hexRgb(ramp[2]);
  return lightness(r, g, b) > 0.55 ? '#2a1a0c' : '#fbf1dc';
};

let lookKey = '';
let nightNow = -1;
let building = 0;

// (the stylesheet, once a page, last in its head so it comes after the page's own)
if (typeof document !== 'undefined' && !document.getElementById('ui-look')) {
  const style = document.createElement('style');
  style.id = 'ui-look';
  style.textContent = uiCss();
  document.head.append(style);
  document.documentElement.classList.add('ui-look');
  wireTaps();
}

/** Dress the page for the town as it is now: its people's frames, the alignment's warmth, and the night. */
export function applyUiLook(page: UiPage, theme: ThemeId | undefined, cast: number, daylight: number): void {
  const root = document.documentElement;
  if (!root.classList.contains(`page-${page}`)) root.classList.add(`page-${page}`);
  const night = nightDepth(daylight);
  if (night !== nightNow) {
    nightNow = night;
    root.style.setProperty('--ui-night', String(night));
    root.classList.toggle('ui-night', night > 0);
  }
  const step = alignStep(cast);
  const key = `${theme ?? 'town'}:${step}`;
  if (key === lookKey) return;
  lookKey = key;
  const look = lookOf(theme);
  const warm = (r: Ramp) => alignRamp(r, step);
  const face = warm(look.face);
  const accent = warm(look.accent);
  const rim = look.rim && warm(look.rim);
  // (the colours at once; the pictures when they're tinted, unless the look has moved on meanwhile)
  root.style.setProperty('--ui-surface', look.surface);
  root.style.setProperty('--ui-glow', look.glow ?? 'transparent');
  root.style.setProperty('--ui-face-text', textOn(face));
  root.style.setProperty('--ui-on-text', textOn(accent));
  root.style.setProperty('--ui-cut', String(PIECES[look.frame].cut));
  root.style.setProperty('--ui-cut-px', `${PIECES[look.frame].cut}px`);
  const run = ++building;
  void Promise.all([
    tinted(look.frame, rim),
    tinted('stone', face),
    tinted('stone', pressedRamp(face)),
    tinted('stone', disabledRamp(face)),
    tinted('stone', accent),
    tinted('chip', face),
    tinted('chip', accent),
    tinted('rod', rim ?? accent),
    tinted('chip', rim ?? accent),
  ]).then(([frame, btn, down, off, on, chip, chipOn, divider, handle]) => {
    if (run !== building) return;
    const made: Record<string, HTMLCanvasElement> = { frame, btn, 'btn-down': down, 'btn-off': off, 'btn-on': on, chip, 'chip-on': chipOn, divider, handle };
    canvases.clear();
    canvasVersion++;
    for (const [k, c] of Object.entries(made)) {
      canvases.set(k, c);
      root.style.setProperty(`--ui-${k}`, `url("${c.toDataURL()}")`);
    }
  }).catch((err) => console.warn('[ui] frames not tinted:', err));
}

/** Mark an element as a framed box (or a big one: the event box, the news page) for a panel that builds its own. */
export function framed<T extends HTMLElement>(el: T, kind: 'frame' | 'frame-big' | 'btn' | 'tab' | 'chip' = 'frame'): T {
  el.classList.add(`ui-${kind}`);
  if (kind === 'frame-big') el.classList.add('ui-frame');
  return el;
}

/* ------------------------------------------------------------ tapping: pressed while held, and a soft click */

const PRESSABLE = 'button, .place, .tab, [role="button"]';

type ClickWin = Window & { __uiClick?: () => void };
/** The strip's click (main.ts sets it), from whichever page this is: the strip itself, the phone's page round it, or
 *  the menus beside it. */
function findClick(): (() => void) | null {
  const tryWin = (w: Window | null | undefined) => {
    try {
      return (w as ClickWin | null)?.__uiClick ?? null;
    } catch {
      return null;
    }
  };
  const here = tryWin(window);
  if (here) return here;
  try {
    for (const w of [window.parent, window.top]) {
      if (!w || w === window) continue;
      const f = tryWin(w);
      if (f) return f;
      for (const frame of Array.from(w.document.querySelectorAll('iframe'))) {
        const g = tryWin(frame.contentWindow);
        if (g) return g;
      }
    }
    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
      const g = tryWin(frame.contentWindow);
      if (g) return g;
    }
  } catch {
    /* (the desktop's menu is a window of its own: no sound from there) */
  }
  return null;
}

let lastClick = 0;
function wireTaps(): void {
  let held: Element | null = null;
  const lift = () => {
    held?.classList.remove('ui-down');
    held = null;
  };
  document.addEventListener('pointerdown', (e) => {
    const t = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    lift();
    held = t;
    t.classList.add('ui-down');
  }, { capture: true, passive: true });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'scroll'] as const) document.addEventListener(ev, lift, { capture: true, passive: true });
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target.closest(PRESSABLE) : null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    const now = performance.now();
    if (now - lastClick < 60) return;
    lastClick = now;
    findClick()?.();
  }, { capture: true, passive: true });
}
