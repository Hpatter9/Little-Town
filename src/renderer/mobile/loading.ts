// The loading screen (the owner's ask: "Let's do a loading screen! How can we make it interesting, show off the cool
// game we made, and have a game logo"). Its own small script (loading.js, first in the page's body), so it is up before
// the page's big one: the logo (loading/logo.ts) over a living scene, a bar in the frame set's look, a line of what is
// loading in the game's voice and a tip. Behind the logo, the player's own town at night, painted from the save
// (loading/sketch.ts): its houses dark until the files come in, their lights coming on one by one as the bar fills, so
// the bar is the town waking up. A town still being founded (and a first game) shows the founding fire with Duchess
// the goat instead.
//
// Honest: the bar is the files loaded over the files wanted (the page, the town from the save, the strip's script,
// then every picture the first view draws: loading/stripLoad.ts). The screen leaves as soon as the strip says its first
// view is in, but never before it can be read (`MIN_SHOW_MS`); if nothing arrives for a while, "Tap to enter" lets the
// player through. The game's clock is held until it has gone (mobile.ts, `release`). The ☰ menu can turn the scene off
// for a slow phone (`littletown.loadingScene`); the preload stays.

import { FADE_MS, lightsLit, loadLine, loadShare, loadStage, type LoadStep } from '../loading/loadProgress';
import { drawMark, LOGO_H, LOGO_W, loadPieces, Logo, WINDOWS, type Pieces } from '../loading/logo';
import type { TownSketch } from '../loading/sketch';
import type { StripReport } from '../loading/stripLoad';
import { TIPS } from './tips';

export interface LoadingHost {
  /** A file of the page's own has come: its script, the town from the save. */
  got(step: 'page' | 'town'): void;
  /** The town to paint behind the logo. */
  town(s: TownSketch): void;
  /** The strip's report (loading/stripLoad.ts). */
  strip(r: StripReport): void;
  /** Called once the screen has gone (at once if it already has). */
  onReveal(cb: () => void): void;
  readonly revealed: boolean;
  /** The square mark at a size (the icon tool, the New Town screen), once the pieces are in. */
  mark(size: number): Promise<HTMLCanvasElement>;
  /** When each thing came (ms since the page began), for measuring. */
  readonly times: Record<string, number>;
}

const SCENE_KEY = 'littletown.loadingScene';
/** How long a beat of the screen's life is (ms): the scene and the logo move a step a beat. */
const BEAT_MS = 110;
/** How long a tip stays up (ms). */
const TIP_MS = 4200;
/** The page's own files: its script, the town (the save read and the first snapshot), the strip's script. */
const PAGE_FILES = 3;

const readKey = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
/** The scene is shown unless the ☰ menu turned it off (mobile.ts). */
const sceneOn = (): boolean => readKey(SCENE_KEY) !== '0';

const CSS = `
#loading-screen { position: fixed; inset: 0; z-index: 1000; overflow: hidden; background: linear-gradient(#070a18, #141428 45%, #2a1c1a);
  color: #f1e2c2; font-family: 'Alegreya Sans', system-ui, sans-serif; transition: opacity ${FADE_MS}ms ease; touch-action: none; user-select: none; }
#loading-screen.gone { opacity: 0; pointer-events: none; }
#loading-screen > .ls-scene { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
#loading-screen > .ls-veil { position: absolute; inset: 0; background: linear-gradient(rgba(6,8,20,0.7), rgba(6,8,20,0.35) 55%, rgba(6,8,20,0) 70%, rgba(6,8,20,0.4)); }
@media (orientation: landscape) and (max-height: 560px) {
  #loading-screen > .ls-veil { background: linear-gradient(90deg, rgba(6,8,20,0.75), rgba(6,8,20,0.4) 50%, rgba(6,8,20,0) 62%, rgba(6,8,20,0.3)); }
}
#loading-screen .ls-front { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 10px; padding: calc(env(safe-area-inset-top) + 7vh) 16px env(safe-area-inset-bottom); box-sizing: border-box; }
#loading-screen .ls-logo { flex: none; display: flex; justify-content: center; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6)); image-rendering: pixelated; }
#loading-screen .ls-bar { position: relative; width: min(78vw, 340px); height: 18px; box-sizing: border-box; border: 6px solid transparent;
  border-image: var(--ls-rod) 6 8 fill / 6px 8px stretch; image-rendering: pixelated; }
#loading-screen .ls-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; transition: width 180ms linear;
  background: repeating-linear-gradient(90deg, #f0d870 0 10px, #d8b850 10px 12px); box-shadow: 0 0 8px rgba(255,214,120,0.55); }
#loading-screen .ls-line { font: 700 15px/1.2 'Alegreya SC', Georgia, serif; letter-spacing: 0.06em; color: #e8c88a; text-shadow: 0 1px 2px #000; min-height: 18px; }
#loading-screen .ls-tip { max-width: min(86vw, 420px); min-height: 52px; text-align: center; font-size: 13px; line-height: 1.35; color: #d8c8a6;
  text-shadow: 0 1px 2px #000; transition: opacity 300ms; }
#loading-screen .ls-tip b { display: block; color: #e8c88a; font-family: 'Alegreya SC', Georgia, serif; }
#loading-screen .ls-tap { margin-top: 4px; padding: 8px 18px; font: 700 15px 'Alegreya SC', Georgia, serif; color: #2a1a0c; background: #e8c88a;
  border: 2px solid #1e130a; border-radius: 4px; }
@media (orientation: landscape) and (max-height: 560px) {
  #loading-screen .ls-front { gap: 5px; right: 42%; justify-content: center; padding-top: env(safe-area-inset-top); }
  #loading-screen .ls-bar { width: min(48vw, 300px); }
  #loading-screen .ls-tip { min-height: 34px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) { #loading-screen .ls-fill { transition: none; } }
`;

/** The ground's colours (the minimap's, map/minimap.ts), by land.ts's codes. */
const GROUND: Record<string, string> = {
  '.': '#5f8f46', f: '#2f5b2d', r: '#7b776f', m: '#4f6e4a', h: '#7a8a4a', w: '#3c74a8', F: '#8a6a3c', s: '#d2b878', M: '#5a5a62', H: '#2a2622', S: '#6fa6c8',
};
const WINTER: Record<string, string> = { '.': '#d9e2ea', f: '#4c6150', m: '#b8c4c6', h: '#c6ccd0', F: '#c8c6bf', s: '#e4e0d4' };
/** The houses' windows, in their pictures (map/packBuildings.ts `lamps`), and a tent's door. */
const LAMPS: Record<string, [number, number][]> = {
  house1: [[81, 51], [39, 85], [81, 85]],
  house2: [[80, 74], [110, 74], [132, 74], [37, 106], [80, 106]],
  house4: [[97, 87], [114, 122]],
  tent: [[24, 52]],
};

function start(): LoadingHost {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = sceneOn();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  // (the display face, before the page's own styles name it)
  try {
    for (const [family, file, weight] of [
      ['Alegreya SC', 'alegreya-sc-latin-700-normal.woff2', '700'],
      ['Alegreya Sans', 'alegreya-sans-latin-400-normal.woff2', '400'],
    ]) {
      const f = new FontFace(family, `url(fonts/${file})`, { weight });
      document.fonts.add(f);
      void f.load().catch(() => undefined);
    }
  } catch {}

  const root = document.createElement('div');
  root.id = 'loading-screen';
  const sceneCanvas = document.createElement('canvas');
  sceneCanvas.className = 'ls-scene';
  const veil = document.createElement('div');
  veil.className = 'ls-veil';
  const front = document.createElement('div');
  front.className = 'ls-front';
  const logoBox = document.createElement('div');
  logoBox.className = 'ls-logo';
  const bar = document.createElement('div');
  bar.className = 'ls-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Loading');
  const fill = document.createElement('div');
  fill.className = 'ls-fill';
  bar.append(fill);
  const line = document.createElement('div');
  line.className = 'ls-line';
  line.setAttribute('aria-live', 'polite');
  const tip = document.createElement('div');
  tip.className = 'ls-tip';
  const tap = document.createElement('button');
  tap.className = 'ls-tap';
  tap.textContent = 'Tap to enter';
  tap.hidden = true;
  front.append(logoBox, bar, line, tip, tap);
  if (scene) root.append(sceneCanvas);
  root.append(veil, front);
  document.body.prepend(root);

  // (what's in)
  const shownAt = performance.now();
  const times: Record<string, number> = { shown: Math.round(shownAt) };
  const mark = (what: string) => (times[what] ??= Math.round(performance.now()));
  let movedAt = shownAt;
  const steps = new Set<string>();
  let strip: StripReport = { wanted: 0, done: 0, look: null, ready: false };
  let sketch: TownSketch | null = null;
  // (no save at all: a first game, still to be founded)
  const firstGame = readKey('littletown.save') === null;
  let revealed = false;
  let leaving = false;
  const waiting: (() => void)[] = [];
  let shown = 0;
  let lastLine = '';
  const share = () => loadShare([{ wanted: PAGE_FILES, done: steps.size }, strip]);
  const step = (): LoadStep => (!steps.has('page') ? 'page' : !steps.has('town') ? 'town' : !steps.has('strip') ? 'strip' : strip.ready ? 'done' : (strip.look ?? 'people'));

  // (the pieces: the logo's and the scene's, small files beside the page)
  let pieces: Pieces = {};
  let logo: Logo | null = null;
  const piecesIn = loadPieces('loading/').then((p) => {
    pieces = p;
    logo = new Logo(p);
    logoBox.append(logo.canvas);
    // (the bar's trough: the frame set's rod, DawnLike's gold-trimmed bar, closed at its right end with its own left cap)
    if (p.gui) {
      const rod = document.createElement('canvas');
      rod.width = 48;
      rod.height = 14;
      const rg = rod.getContext('2d')!;
      rg.drawImage(p.gui, 96, 1, 40, 14, 0, 0, 40, 14);
      rg.translate(48, 0);
      rg.scale(-1, 1);
      rg.drawImage(p.gui, 96, 1, 8, 14, 0, 0, 8, 14);
      bar.style.setProperty('--ls-rod', `url(${rod.toDataURL()})`);
    }
    layout();
    return p;
  });

  // (a tip a while, from the first hour's tips: mobile/tips.ts)
  let tipAt = -Infinity;
  let tipN = Math.floor(Math.random() * TIPS.length);
  const nextTip = () => {
    const t = TIPS[tipN++ % TIPS.length];
    tip.replaceChildren();
    const b = document.createElement('b');
    b.textContent = t.title;
    tip.append(b, document.createTextNode(t.text.length > 150 ? `${t.text.slice(0, t.text.lastIndexOf(' ', 148))}…` : t.text));
  };

  // (the scene's ground, painted once for a town and a screen size)
  let ground: HTMLCanvasElement | null = null;
  let groundKey = '';
  const layout = () => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sideways = W > H && H < 560;
    // (the logo: most of the width upright; on its side, held to under half the height)
    const cssW = sideways ? Math.min(W * 0.5, ((H * 0.46) / 340) * LOGO_W) : Math.min(W - 32, 440);
    logo?.size(cssW, dpr);
    // (its room kept while its pieces come, so nothing jumps when it appears)
    logoBox.style.width = `${Math.round(cssW)}px`;
    logoBox.style.height = `${Math.round((cssW * LOGO_H) / LOGO_W)}px`;
    if (scene) {
      sceneCanvas.width = Math.round(W * dpr);
      sceneCanvas.height = Math.round(H * dpr);
      groundKey = '';
    }
  };
  window.addEventListener('resize', layout);
  layout();

  const reveal = () => {
    if (leaving) return;
    leaving = true;
    mark('reveal');
    root.classList.add('gone');
    // (the page's clock and cards wait on this)
    revealed = true;
    for (const cb of waiting.splice(0)) cb();
    setTimeout(() => root.remove(), FADE_MS + 50);
  };
  tap.addEventListener('click', reveal);

  // the scene: the town at night waking up, or the founding fire
  /** Where the town's middle is drawn (a share of the screen), clear of the logo: under it upright, beside it on its
   *  side; and how much of the screen's width (or height) its buildings fill. */
  const townAt = (W: number, H: number) => (W > H ? { x: 0.72, y: 0.52, fill: Math.min(0.5 * W, 0.9 * H) } : { x: 0.5, y: 0.76, fill: Math.min(0.96 * W, 0.42 * H) });
  const paintGround = (s: TownSketch, W: number, H: number): { k: number; ox: number; oy: number } => {
    // (the buildings' extent fills its share of the screen; the land about them runs on to the edges)
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const b of s.buildings) {
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
    }
    if (!s.buildings.length) [x0, y0, x1, y1] = [0, 0, s.w, s.h];
    const at = townAt(W, H);
    const k = Math.max(at.fill / Math.max(8, x1 - x0, y1 - y0), W / s.w, H / s.h);
    const ox = W * at.x - ((x0 + x1) / 2) * k;
    const oy = H * at.y - ((y0 + y1) / 2) * k;
    const key = `${W}x${H}|${s.x},${s.y},${s.w},${s.h}|${s.buildings.length}`;
    if (key === groundKey && ground) return { k, ox, oy };
    groundKey = key;
    ground ??= document.createElement('canvas');
    ground.width = W;
    ground.height = H;
    const g = ground.getContext('2d')!;
    // (the land, a cell a dab, softened: painted in)
    const cells = document.createElement('canvas');
    cells.width = s.w;
    cells.height = s.h;
    const cg = cells.getContext('2d')!;
    const img = cg.createImageData(s.w, s.h);
    const winter = s.season === 'winter';
    for (let i = 0; i < s.w * s.h; i++) {
      const c = s.ground[i];
      const hex = s.roads[i] === '#' ? '#b8a47c' : (winter && WINTER[c]) || GROUND[c] || '#5f8f46';
      img.data[i * 4] = parseInt(hex.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(cells, ox, oy, s.w * k, s.h * k);
    // (the cut's edges fade into the night, never a hard line)
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const fade = 4 * k;
    for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [
      [ox, oy, s.w * k, fade, 0, oy, 0, oy + fade],
      [ox, oy + s.h * k - fade, s.w * k, fade, 0, oy + s.h * k, 0, oy + s.h * k - fade],
      [ox, oy, fade, s.h * k, ox, 0, ox + fade, 0],
      [ox + s.w * k - fade, oy, fade, s.h * k, ox + s.w * k, 0, ox + s.w * k - fade, 0],
    ]) {
      const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, w, h);
    }
    g.restore();
    // (the buildings in their pack pictures, back to front)
    g.imageSmoothingEnabled = k < 2;
    const order = [...s.buildings].sort((a, b) => a.y + a.h - (b.y + b.h));
    for (const b of order) {
      const x = ox + b.x * k;
      const y = oy + b.y * k;
      const w = b.w * k;
      const h = b.h * k;
      if (b.kind === 'field') {
        if (pieces.soil) {
          const pat = g.createPattern(pieces.soil, 'repeat');
          if (pat) {
            g.save();
            g.translate(x, y);
            g.scale(k / 16, k / 16);
            g.fillStyle = pat;
            g.fillRect(0, 0, b.w * 16, b.h * 16);
            g.restore();
          }
        }
        continue;
      }
      if (b.kind === 'wall') {
        if (pieces.stakes) g.drawImage(pieces.stakes, x, y + h - k * 1.2, w, k * 1.2);
        continue;
      }
      if (b.kind === 'fire') {
        if (pieces.firepit) g.drawImage(pieces.firepit, x, y + h - w * 0.64, w, w * 0.64);
        continue;
      }
      const im = pictureOf(b);
      if (!im) continue;
      const pw = w + k * 0.6;
      const ph = (im.naturalHeight / im.naturalWidth) * pw;
      g.drawImage(im, x - k * 0.3, y + h - ph, pw, ph);
    }
    // (night over all of it)
    g.fillStyle = 'rgba(8, 12, 34, 0.62)';
    g.fillRect(0, 0, W, H);
    return { k, ox, oy };
  };
  const pictureOf = (b: TownSketch['buildings'][number]): HTMLImageElement | undefined =>
    b.kind === 'hall' ? pieces.house4 : b.kind === 'tent' ? (pieces.camp ?? pieces.tent) : b.w >= 4 ? pieces.house2 : b.id % 3 === 0 ? pieces.house2 : pieces.house1;
  const lampsOf = (b: TownSketch['buildings'][number]): { im: HTMLImageElement; at: [number, number][] } | null => {
    const im = b.kind === 'fire' ? pieces.firepit : b.kind === 'field' || b.kind === 'wall' ? undefined : pictureOf(b);
    if (!im) return null;
    if (b.kind === 'fire') return { im, at: [[22, 6]] };
    const key = im === pieces.house4 ? 'house4' : im === pieces.house2 ? 'house2' : im === pieces.camp || im === pieces.tent ? 'tent' : 'house1';
    return { im, at: LAMPS[key] };
  };
  const glow = (g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255, 214, 130, ${a})`);
    gr.addColorStop(0.35, `rgba(255, 170, 70, ${a * 0.45})`);
    gr.addColorStop(1, 'rgba(255, 150, 60, 0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // (embers drifting up: from the fire, or the town's chimneys)
  const embers = Array.from({ length: 26 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.37) % 1, s: 0.6 + ((i * 7) % 5) / 5 }));
  const drawTown = (g: CanvasRenderingContext2D, s: TownSketch, W: number, H: number, sh: number, beat: number) => {
    const { k, ox, oy } = paintGround(s, W, H);
    g.drawImage(ground!, 0, 0);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const lights = s.buildings.filter((b) => lampsOf(b));
    const lit = lightsLit(sh, lights.length);
    lights.slice(0, lit).forEach((b, i) => {
      const l = lampsOf(b)!;
      const w = b.w * k + k * 0.6;
      const scale = w / l.im.naturalWidth;
      const top = oy + (b.y + b.h) * k - l.im.naturalHeight * scale;
      const flick = reduced ? 1 : 0.85 + 0.15 * (((beat + i * 3) % 4) / 3);
      for (const [lx, ly] of l.at) glow(g, ox + b.x * k - k * 0.3 + lx * scale, top + ly * scale, Math.max(5, k * 0.9) * flick, 0.7);
    });
    g.restore();
  };
  const drawFounding = (g: CanvasRenderingContext2D, W: number, H: number, sh: number, beat: number, t: number) => {
    // (the night: stars, a dark meadow, the fire catching as the files come in, Duchess about it)
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) {
      const x = ((i * 97.3) % 1000) / 1000;
      const y = ((i * 61.7) % 1000) / 1000;
      g.globalAlpha = 0.25 + (((i + (reduced ? 0 : beat >> 2)) % 5) / 5) * 0.5;
      g.fillRect(Math.round(x * W), Math.round(y * H * 0.6), 2, 2);
    }
    g.globalAlpha = 1;
    // (the stage runs from the tent, 84 art px left of the fire, to Duchess's furthest, 122 right: all of it in view)
    const k = Math.max(2, Math.floor(Math.min(W > H ? (W * 0.27) / 122 : W / 230, H / 120)));
    const base = Math.round(H * (W > H ? 0.78 : 0.86));
    const cx = Math.round(W * (W > H ? 0.72 : 0.5));
    g.fillStyle = '#16200f';
    g.fillRect(0, base, W, H - base);
    g.fillStyle = '#1e2a14';
    g.fillRect(0, base, W, k * 2);
    g.imageSmoothingEnabled = false;
    // (the fire's light first, under everything)
    const catching = 0.35 + 0.65 * sh;
    g.save();
    g.globalCompositeOperation = 'lighter';
    glow(g, cx, base - k * 8, k * 70 * catching * (reduced ? 1 : 0.93 + 0.07 * (beat % 3)), 0.55);
    g.restore();
    if (pieces.camp) g.drawImage(pieces.camp, cx - k * 84, base - pieces.camp.naturalHeight * k + k * 2, pieces.camp.naturalWidth * k, pieces.camp.naturalHeight * k);
    if (pieces.log) g.drawImage(pieces.log, cx + k * 22, base - pieces.log.naturalHeight * k + k, pieces.log.naturalWidth * k, pieces.log.naturalHeight * k);
    if (pieces.firepit) g.drawImage(pieces.firepit, cx - k * 22, base - k * 26, k * 44, k * 28);
    // (the flames: the 5000 Pixel Effects' fire, grown as the bar fills)
    if (pieces.flame) {
      const f = reduced ? 2 : beat % 8;
      const fs = Math.round(k * (12 + 16 * catching));
      for (const [dx, n] of [
        [-0.2, 0],
        [0.2, 3],
      ] as const)
        g.drawImage(pieces.flame, ((f + n) % 8) * 32, 0, 32, 32, cx - fs / 2 + dx * k * 22, base - k * 18 - fs + k * 4, fs, fs);
    }
    // (Duchess, ambling back and forth by the fire, stopping to chew: her sheet is three steps left, three right)
    if (pieces.goat) {
      const ph = reduced ? 0.9 : (t / 9000) % 1;
      const go = ph < 0.3 ? ph / 0.3 : ph < 0.5 ? 1 : ph < 0.8 ? 1 - (ph - 0.5) / 0.3 : 0;
      const walking = ph < 0.3 || (ph >= 0.5 && ph < 0.8);
      const right = ph < 0.3;
      const step = walking ? [0, 1, 2, 1][beat % 4] : 1;
      const frame = (right ? 3 : 0) + step;
      const gx = cx + k * 34 + go * k * 40;
      g.drawImage(pieces.goat, frame * 48, 0, 48, 48, Math.round(gx), base - k * 44 + (walking ? 0 : (beat >> 1) % 2) * k * 0.5, k * 48, k * 48);
    }
  };
  const drawEmbers = (g: CanvasRenderingContext2D, W: number, H: number, beat: number, founding: boolean) => {
    if (reduced) return;
    g.fillStyle = '#ffc870';
    for (const e of embers) {
      const life = (e.y + beat * 0.012 * e.s) % 1;
      const x = founding ? W * (W > H ? 0.72 : 0.5) + (e.x - 0.5) * W * 0.16 + Math.sin((beat + e.x * 40) / 6) * 6 : e.x * W + Math.sin((beat + e.x * 40) / 6) * 8;
      const y = founding ? H * (W > H ? 0.74 : 0.82) - life * H * 0.5 : H * (1 - life);
      g.globalAlpha = (1 - life) * 0.8;
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    g.globalAlpha = 1;
  };

  // each beat: the bar, the line, the tip, the logo's life and the scene
  let beat = 0;
  let lastBeat = 0;
  const frame = (now: number) => {
    if (revealed && !root.isConnected) return;
    const sh = share();
    const stage = loadStage({ shownAt, now: performance.now(), ready: strip.ready, movedAt });
    if (stage === 'reveal') reveal();
    tap.hidden = stage !== 'stalled' || leaving;
    if (sh !== shown) {
      shown = sh;
      fill.style.width = `${(sh * 100).toFixed(1)}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(sh * 100)));
    }
    const said = loadLine(step(), (now - shownAt) / 2600);
    if (said !== lastLine) line.textContent = lastLine = said;
    if (now - tipAt > TIP_MS) {
      tipAt = now;
      nextTip();
    }
    if (now - lastBeat >= BEAT_MS) {
      lastBeat = now;
      beat++;
      // (the sun creeps along the arc as the files come in; the gold shimmers by now and then)
      const cycle = (beat % 40) / 40;
      logo?.draw(0.08 + 0.84 * sh, lightsLit(sh, WINDOWS), reduced || cycle > 0.45 ? null : cycle / 0.45, beat);
      if (scene) {
        const W = sceneCanvas.width;
        const H = sceneCanvas.height;
        const g = sceneCanvas.getContext('2d')!;
        g.clearRect(0, 0, W, H);
        // (a saved town waits in the night for its own map; only a first game, or a town still founding, has the fire)
        const founding = firstGame || !!sketch?.founding;
        if (founding) drawFounding(g, W, H, sh, beat, now);
        else if (sketch) drawTown(g, sketch, W, H, sh, beat);
        if (founding || sketch) drawEmbers(g, W, H, beat, founding);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    got: (s) => {
      if (steps.has(s)) return;
      steps.add(s);
      mark(s);
      movedAt = performance.now();
    },
    town: (s) => {
      sketch = s;
      groundKey = '';
    },
    strip: (r) => {
      if (!steps.has('strip')) steps.add('strip');
      mark('strip');
      if (r.ready) mark('ready');
      if (r.done !== strip.done || r.wanted !== strip.wanted || r.ready !== strip.ready) movedAt = performance.now();
      strip = r;
    },
    onReveal: (cb) => (revealed ? cb() : void waiting.push(cb)),
    get revealed() {
      return revealed;
    },
    mark: (size) => piecesIn.then((p) => drawMark(p, size)),
    times,
  };
}

(window as unknown as { __loading?: LoadingHost }).__loading = start();
