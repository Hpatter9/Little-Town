// The scenery behind a watched fight (fight/fightView.ts), in three layers that scroll at their own pace as the party
// walks: the far one (sky, sun, clouds, mountains), the middle one (hills and the tree line, a quarry's cliff, a cave's
// back wall) and the near one (the ground they walk on, with its path, grass, flowers, stones and the rest). Each place
// has its own look: a berry thicket, a riverbank, deep woods, a quarry, a cave. Everything repeats across the width, so
// the layers tile as they scroll.

import { PAL } from './palette';
import { mixHex, noTone, paint, type Painter, type PixelArt } from './pixelArt';
import { makeSpriteSet, type SpriteSet } from './sprites';
import { hash, shade } from './terrain';

export const BACK_W = 320;
export const BACK_H = 320;
/** The row where the land meets the sky. */
export const BACK_HORIZON = 200;
const HZ = BACK_HORIZON;

/** The near edge's height: its own layer, kept along the bottom of the view whatever its height. */
export const FRONT_H = 40;

export interface Backdrop {
  far: PixelArt;
  mid: PixelArt;
  near: PixelArt;
  front: PixelArt;
}

type Scenery = 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';

const cache = new Map<string, Backdrop>();

export function fightBackdrop(scenery: string, seed: number): Backdrop {
  const key = `${scenery}|${seed}`;
  let b = cache.get(key);
  if (!b) {
    const sc = (['thicket', 'river', 'woods', 'quarry', 'cave'].includes(scenery) ? scenery : 'thicket') as Scenery;
    const set = makeSpriteSet(0x5ee0 + seed, noTone);
    b = {
      far: layer((p) => far(p, sc, seed), true),
      mid: layer((p) => mid(p, sc, seed, set)),
      near: layer((p) => near(p, sc, seed, set)),
      front: paint(BACK_W, FRONT_H, noTone, (p) => foreground(p, sc, seed, set), 1, { stuff: false, tile: true }),
    };
    if (cache.size > 6) cache.clear();
    cache.set(key, b);
  }
  return b;
}

const layer = (draw: (p: Painter) => void, plain = false) => paint(BACK_W, BACK_H, noTone, draw, plain ? 0.5 : 1, { stuff: false, tile: true });

/* ------------------------------------------------------------ helpers that wrap round the width */

/** Smooth noise along x that repeats every BACK_W (cells across the width). */
function wave(seed: number, x: number, cells: number): number {
  const t = (((x % BACK_W) + BACK_W) % BACK_W) * (cells / BACK_W);
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(seed, i % cells) * (1 - u) + hash(seed, (i + 1) % cells) * u;
}
/** Rougher noise: a few waves on top of each other (0..1). */
const rough = (seed: number, x: number) => wave(seed, x, 4) * 0.5 + wave(seed + 1, x, 11) * 0.3 + wave(seed + 2, x, 29) * 0.2;

/** Draw at x and again a width either side, so whatever crosses an edge carries on from the other. */
function wrap(x: number, w: number, draw: (x: number) => void): void {
  draw(x);
  if (x < 0) draw(x + BACK_W);
  if (x + w > BACK_W) draw(x - BACK_W);
}

/** A sprite stood with its feet at (x, y), scaled. */
function put(p: Painter, art: PixelArt, x: number, y: number, s: number, flip = false): void {
  const w = art.width * s;
  const h = art.height * s;
  const src = art.texture.source.resource as CanvasImageSource;
  wrap(Math.round(x - w / 2), w, (xx) => {
    if (!flip) p.ctx.drawImage(src, xx, Math.round(y - h), w, h);
    else {
      p.ctx.save();
      p.ctx.translate(xx + w, Math.round(y - h));
      p.ctx.scale(-1, 1);
      p.ctx.drawImage(src, 0, 0, w, h);
      p.ctx.restore();
    }
  });
}

function oval(p: Painter, cx: number, cy: number, rx: number, ry: number, c: string): void {
  wrap(cx - rx, rx * 2, (x) => p.ellipse(x + rx, cy, rx, ry, c));
}

/** Scatter n things down the ground from a seed: depth t (0 at the horizon, 1 nearest), x, and a die. */
function scatter(seed: number, n: number, from: number, to: number, bias = 0.8): { x: number; y: number; t: number; d: number }[] {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = hash(seed, k, 1) ** bias;
    out.push({ x: Math.floor(hash(seed, k, 2) * BACK_W), y: Math.round(from + t * (to - from)), t, d: hash(seed, k, 3) });
  }
  return out.sort((a, b) => a.y - b.y);
}

/* ------------------------------------------------------------ the far layer: sky and mountains */

const SKY: Record<Scenery, [string, string]> = {
  thicket: ['#3f73bc', '#bcd8ee'],
  river: ['#3a78c4', '#c4e0f0'],
  woods: ['#466e9e', '#b8cfd8'],
  quarry: ['#4f78b0', '#d8d4c8'],
  cave: ['#120e16', '#2a2232'],
};

function far(p: Painter, sc: Scenery, seed: number): void {
  const [top, low] = SKY[sc];
  // the sky, in bands dithered into each other (as the old games did)
  for (let y = 0; y < BACK_H; y++) {
    const t = Math.min(1, y / HZ);
    const band = Math.floor(t * 12) / 12;
    const next = Math.min(1, band + 1 / 12);
    const within = t * 12 - Math.floor(t * 12);
    for (let x = 0; x < BACK_W; x += 1) {
      // (an ordered dither: the next band's colour creeps in toward its edge)
      const bayer = [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
      p.px(x, y, mixHex(top, low, within > bayer + 0.25 ? next : band));
    }
  }
  if (sc === 'cave') return caveFar(p, seed);
  // the sun's glow, low in the sky, and the sun
  const sx = 70 + Math.floor(hash(seed, 9) * 180);
  const sy = 120 + Math.floor(hash(seed, 10) * 30);
  // (rings of thin warm light laid one over another, so it fades into whatever sky is behind)
  p.ctx.globalAlpha = 0.07;
  for (let r = 40; r > 6; r -= 3) oval(p, sx, sy, r, r, '#fff6d8');
  p.ctx.globalAlpha = 1;
  oval(p, sx, sy, 6, 6, '#fffbe8');
  oval(p, sx, sy, 5, 5, '#ffffff');
  // clouds: puffs on a flat foot, lit from above, shaded under
  for (let k = 0; k < 9; k++) {
    const cx = Math.floor(hash(seed, k, 20) * BACK_W);
    const cy = 30 + Math.floor(hash(seed, k, 21) ** 0.7 * 120);
    const w = 14 + Math.floor(hash(seed, k, 22) * 26) * (cy > 110 ? 0.7 : 1);
    cloud(p, cx, cy, w, seed * 31 + k, mixHex(low, top, 0.15));
  }
  // birds, far off
  for (let k = 0; k < 4; k++) {
    const bx = Math.floor(hash(seed, k, 30) * BACK_W);
    const by = 60 + Math.floor(hash(seed, k, 31) * 70);
    p.fline(bx - 1.5, by - 1, bx, by, '#3a4250');
    p.fline(bx, by, bx + 1.5, by - 1, '#3a4250');
  }
  // the mountains, hazy blue with the light on their left faces, snow on the high peaks, strata across
  const haze = mixHex(PAL.rock, low, 0.55);
  const lit = mixHex(haze, '#ffffff', 0.18);
  const dim = mixHex(haze, top, 0.25);
  const peaks: number[] = [];
  for (let x = 0; x < BACK_W; x++) {
    const r = wave(seed + 40, x, 3) * 0.55 + wave(seed + 41, x, 7) * 0.3 + wave(seed + 42, x, 16) * 0.15;
    peaks[x] = Math.round(18 + 62 * r ** 1.6);
  }
  for (let x = 0; x < BACK_W; x++) {
    const h = peaks[x];
    // (which way the slope faces, over a few columns, so the faces come in broad planes)
    const slope = peaks[(x + 3) % BACK_W] - peaks[(x + BACK_W - 3) % BACK_W];
    const face = slope > 1 ? lit : slope < -1 ? dim : haze;
    const foot = HZ - 4;
    for (let y = foot - h; y < foot; y++) {
      const depth = (y - (foot - h)) / Math.max(1, h);
      let c = mixHex(face, low, depth * 0.45);
      if ((y + Math.round(wave(seed + 47, x, 13) * 6)) % 7 === 0 && depth > 0.15) c = shade(c, -0.06);
      p.px(x, y, c);
    }
    // (snow down from the peak, ragged)
    const snow = h - 48;
    if (snow > 0) for (let y = 0; y < snow * 0.7 + wave(seed + 48, x, 40) * 3; y++) p.px(x, foot - h + y, slope >= 0 ? '#f4f8fc' : '#d0dcea');
  }
  // the furthest hills, nearly sky, and their trees as dots along the top
  const hill = mixHex(PAL.grassDark, low, 0.62);
  for (let x = 0; x < BACK_W; x++) {
    p.rect(x, HZ - 2 - hillAt(seed, x), 1, hillAt(seed, x) + 2, hill);
  }
  // (and copses along their tops, as soft dark blobs)
  if (sc !== 'quarry')
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(hash(seed, k, 62) * BACK_W);
      oval(p, x, HZ - 2 - hillAt(seed, x), 2 + hash(seed, k, 63) * 3, 1.5 + hash(seed, k, 64), mixHex(hill, PAL.pineDark, 0.2));
    }
  // haze over all of it
  p.ctx.globalAlpha = 0.12;
  p.rect(0, HZ - 90, BACK_W, 90, low);
  p.ctx.globalAlpha = 1;
}

const hillAt = (seed: number, x: number) => Math.round(8 + 16 * (wave(seed + 60, x, 5) * 0.7 + wave(seed + 61, x, 13) * 0.3));

function cloud(p: Painter, cx: number, cy: number, w: number, seed: number, under: string): void {
  const puffs: [number, number, number][] = [];
  const n = 3 + Math.floor(w / 9);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const r = 3 + (1 - Math.abs(t - 0.5) * 2) * w * 0.22 + hash(seed, i) * 3;
    puffs.push([cx - w / 2 + t * w, cy - r * 0.55, r]);
  }
  for (const [x, y, r] of puffs) oval(p, x, y + 2, r, r * 0.75, mixHex(under, '#d8e0ec', 0.6));
  for (const [x, y, r] of puffs) oval(p, x, y, r, r * 0.72, '#eef3f8');
  for (const [x, y, r] of puffs) oval(p, x - r * 0.25, y - r * 0.3, r * 0.55, r * 0.4, '#ffffff');
  // (a flat foot)
  wrap(cx - w / 2 - 3, w + 6, (x) => p.rect(x, cy, w + 6, 2, mixHex(under, '#e0e6f0', 0.5)));
}

/** The back of a cave: rough rock in leaning strata, cracks, a far glow, and crystals catching it. */
function caveFar(p: Painter, seed: number): void {
  for (let y = 0; y < HZ + 10; y++)
    for (let x = 0; x < BACK_W; x++) {
      // (strata that lean and bend, broken into lumps)
      const bend = wave(seed + 70, x, 5) * 18 + wave(seed + 71, x, 17) * 5;
      const stratum = Math.floor((y + bend) / 11);
      const lump = wave(seed + 72 + stratum, x, 14 + (stratum % 3) * 4);
      const within = ((y + bend) % 11) / 11;
      let c = mixHex('#1e1924', '#40384a', lump * 0.75 + (y / HZ) * 0.2);
      if (within < 0.12) c = mixHex(c, '#57506a', 0.35); // (each stratum's lit top)
      if (within > 0.88) c = '#141018'; // (and the dark seam under it)
      p.px(x, y, c);
    }
  // cracks wandering down the face
  for (let k = 0; k < 22; k++) {
    let x = hash(seed, k, 76) * BACK_W;
    let y = hash(seed, k, 77) * (HZ - 40);
    for (let i = 0; i < 26; i++) {
      p.fpx(((x % BACK_W) + BACK_W) % BACK_W, y, '#0e0b12');
      x += (hash(seed, k * 40 + i, 78) - 0.5) * 1.6;
      y += 0.6;
    }
  }
  // a glow from deeper in
  const gx = 60 + Math.floor(hash(seed, 79) * 200);
  p.ctx.globalAlpha = 0.5;
  for (let r = 60; r > 0; r -= 5) oval(p, gx, HZ - 40, r, r * 0.7, mixHex('#2a2232', '#6a5490', ((60 - r) / 60) ** 2));
  p.ctx.globalAlpha = 1;
  // crystals in the wall, in clusters
  for (let k = 0; k < 10; k++) {
    const cx = Math.floor(hash(seed, k, 73) * BACK_W);
    const cy = 50 + Math.floor(hash(seed, k, 74) * (HZ - 60));
    const c = ['#7ad8e8', '#b07ae8', '#7ae8a0'][k % 3];
    p.ctx.globalAlpha = 0.22;
    oval(p, cx, cy - 3, 10, 8, c);
    p.ctx.globalAlpha = 1;
    for (let j = 0; j < 3; j++) {
      const x = cx + (j - 1) * 3;
      const h = 4 + Math.floor(hash(seed, k * 3 + j, 75) * 6);
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round((1 - i / h) * 2.5));
        p.rect(x + (j - 1) * Math.floor(i / 4), cy - i, w, 1, i >= h - 1 ? '#ffffff' : i % 3 === 0 ? mixHex(c, '#ffffff', 0.35) : c);
      }
    }
  }
}

/* ------------------------------------------------------------ the middle layer: tree line, cliffs, columns */

function mid(p: Painter, sc: Scenery, seed: number, set: SpriteSet): void {
  if (sc === 'cave') return caveMid(p, seed);
  if (sc === 'quarry') return cliffs(p, seed, set);
  // a near rise of land behind the field, darker than the far hills
  const rise = mixHex(PAL.grassDark, SKY[sc][1], 0.35);
  for (let x = 0; x < BACK_W; x++) {
    const h = Math.round(3 + 8 * rough(seed + 80, x));
    p.rect(x, HZ - h, 1, h + 4, rise);
    if (hash(seed, x, 81) < 0.3) p.px(x, HZ - h - 1, mixHex(rise, '#ffffff', 0.1));
  }
  // the tree line: a crowded back row, small, then a few bigger ones in front
  const back = sc === 'woods' ? set.pine : sc === 'river' ? [...set.broadleaf, ...set.pine.slice(0, 2)] : [...set.broadleaf, ...set.bush];
  const rows = sc === 'woods' ? 34 : sc === 'thicket' ? 22 : 16;
  for (let k = 0; k < rows; k++) {
    const art = back[Math.floor(hash(seed, k, 82) * back.length)];
    put(p, art, (k / rows) * BACK_W + hash(seed, k, 83) * 10, HZ + 1 - Math.floor(hash(seed, k, 84) * 4), 0.5, hash(seed, k, 85) < 0.5);
  }
  // (haze on the back row)
  p.ctx.globalAlpha = 0.18;
  p.rect(0, HZ - 70, BACK_W, 72, SKY[sc][1]);
  p.ctx.globalAlpha = 1;
  const front = sc === 'woods' ? set.pine : sc === 'thicket' ? [...set.broadleaf, ...set.bramble] : set.broadleaf;
  const big = sc === 'woods' ? 9 : 5;
  for (let k = 0; k < big; k++) {
    const art = front[Math.floor(hash(seed, k, 86) * front.length)];
    put(p, art, hash(seed, k, 87) * BACK_W, HZ + 3, 0.75, hash(seed, k, 88) < 0.5);
  }
  if (sc === 'thicket') for (let k = 0; k < 14; k++) put(p, set.bush[k % set.bush.length], hash(seed, k, 89) * BACK_W, HZ + 4, 0.5);
}

/** A quarry's worked face: rock in strata, cracks, ledges with grass on them, cut steps at the foot, spoil heaps. */
function cliffs(p: Painter, seed: number, set: SpriteSet): void {
  const tops: number[] = [];
  // (benches cut into the face: flat runs that step up and down)
  for (let x = 0; x < BACK_W; x++) tops[x] = Math.round(HZ - 22 - 34 * (wave(seed + 90, x, 4) * 0.7 + wave(seed + 89, x, 11) * 0.3) - (wave(seed + 91, x, 6) > 0.55 ? 8 : 0));
  for (let x = 0; x < BACK_W; x++) {
    for (let y = tops[x]; y < HZ + 3; y++) {
      const wob = Math.round(wave(seed + 92, x, 10) * 4);
      const band = Math.floor((y + wob) / 5) % 4;
      let c = [PAL.rock, PAL.rockLight, PAL.rock, mixHex(PAL.rock, PAL.dirtLight, 0.35)][band];
      if ((y + wob) % 5 === 0) c = PAL.rockDark;
      if (y === tops[x]) c = PAL.rockTip;
      // (faces turned to the left catch the light, just under the lip)
      if (y - tops[x] < 6 && tops[(x + 4) % BACK_W] - tops[(x + BACK_W - 4) % BACK_W] < -2) c = mixHex(c, '#ffffff', 0.1);
      p.px(x, y, c);
    }
    if (hash(seed, x, 93) < 0.4) p.px(x, tops[x] - 1, PAL.grassLight);
  }
  // cracks
  for (let k = 0; k < 18; k++) {
    let x = hash(seed, k, 94) * BACK_W;
    let y = tops[Math.floor(x)] + 3;
    const len = 6 + hash(seed, k, 95) * 20;
    for (let i = 0; i < len; i++) {
      p.fpx(((x % BACK_W) + BACK_W) % BACK_W, y, '#3a3634');
      x += hash(seed, k * 50 + i, 96) - 0.5;
      y += 0.5;
    }
  }
  // cut steps at the foot, and the drill marks on them
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(hash(seed, k, 97) * BACK_W);
    const w = 10 + Math.floor(hash(seed, k, 98) * 16);
    const h = 4 + Math.floor(hash(seed, k, 99) * 6);
    wrap(x, w, (xx) => {
      p.rect(xx, HZ + 3 - h, w, h, PAL.rockLight);
      p.rect(xx, HZ + 3 - h, w, 1, PAL.rockTip);
      p.rect(xx + w - 1, HZ + 3 - h, 1, h, PAL.rockDark);
      for (let i = 2; i < w - 2; i += 3) p.fpx(xx + i, HZ + 3 - h + 2, PAL.rockDark);
    });
  }
  for (let k = 0; k < 7; k++) put(p, set.boulder[k % set.boulder.length], hash(seed, k, 100) * BACK_W, HZ + 4, 0.5);
  for (let k = 0; k < 3; k++) put(p, set.outcrop[k % set.outcrop.length], hash(seed, k, 101) * BACK_W, HZ + 4, 0.75);
}

/** A cave's middle: columns where roof and floor have met, stalactites hanging and stalagmites rising. */
function caveMid(p: Painter, seed: number): void {
  const rockLit = '#5a5266';
  const rockMid = '#3c3546';
  const rockDark = '#1c1822';
  /** A tapering spike of rock (down from the roof or up from the floor), lit on its left. */
  const spike = (x: number, from: number, len: number, w: number, down: boolean) => {
    for (let i = 0; i < len; i++) {
      const ww = Math.max(1, Math.round(w * (1 - i / len) ** 0.8));
      const y = down ? from + i : from - i;
      wrap(x - ww / 2, ww, (xx) => {
        p.rect(xx, y, ww, 1, rockMid);
        if (ww > 2) p.px(xx, y, rockLit);
        p.px(xx + ww - 1, y, rockDark);
      });
    }
  };
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(hash(seed, k, 110) * BACK_W);
    const w = 12 + Math.floor(hash(seed, k, 111) * 12);
    for (let y = 0; y < HZ + 6; y++) {
      // (a waist in the middle, wide where it meets the roof and the floor)
      const waist = Math.abs(y - HZ * 0.55) / (HZ * 0.55);
      const ww = Math.round(w * (0.55 + 0.6 * waist ** 2) + Math.sin(y / 9 + k) * 1.5);
      wrap(x - ww / 2, ww, (xx) => {
        p.rect(xx, y, ww, 1, mixHex(rockMid, rockDark, 0.2));
        p.rect(xx, y, 2, 1, rockLit);
        p.rect(xx + ww - 3, y, 3, 1, rockDark);
      });
    }
  }
  for (let k = 0; k < 22; k++) {
    const x = Math.floor(hash(seed, k, 112) * BACK_W);
    const len = 14 + Math.floor(hash(seed, k, 113) ** 1.8 * (HZ - 50));
    spike(x, 0, len, 4 + Math.floor(hash(seed, k, 114) * 8), true);
    p.px(x, len + 1, '#8ad0f0'); // (a drip)
  }
  for (let k = 0; k < 12; k++) spike(Math.floor(hash(seed, k, 115) * BACK_W), HZ + 5, 8 + Math.floor(hash(seed, k, 116) * 22), 5 + Math.floor(hash(seed, k, 117) * 7), false);
}

/* ------------------------------------------------------------ the near layer: the ground */

const GROUND: Record<Scenery, [string, string, string]> = {
  // far, near, and the blotches' dark
  thicket: [PAL.grassLight, PAL.grass, PAL.grassDark],
  river: [PAL.grassLight, PAL.grass, PAL.grassDark],
  woods: [mixHex(PAL.grass, PAL.dirt, 0.3), mixHex(PAL.grassDark, PAL.dirtDark, 0.35), PAL.dirtDark],
  quarry: [mixHex(PAL.rockLight, PAL.dirtLight, 0.4), mixHex(PAL.rock, PAL.dirt, 0.45), PAL.rockDark],
  cave: ['#4a4252', '#2e2836', '#1a161e'],
};

function near(p: Painter, sc: Scenery, seed: number, set: SpriteSet): void {
  const [farC, nearC, darkC] = GROUND[sc];
  const H = BACK_H - HZ;
  for (let y = HZ; y < BACK_H; y++) p.rect(0, y, BACK_W, 1, mixHex(farC, nearC, ((y - HZ) / H) ** 0.6));
  // blotches, flattened by distance: darker and lighter patches
  for (const b of scatter(seed + 120, 90, HZ + 2, BACK_H, 0.9)) {
    const rx = 4 + b.t * 16 + b.d * 6;
    oval(p, b.x, b.y, rx, rx * (0.18 + b.t * 0.12), b.d < 0.5 ? mixHex(nearC, darkC, 0.35) : mixHex(nearC, '#ffffff', 0.08));
  }
  // the river, with its banks, in the distance
  if (sc === 'river') river(p, seed, set);
  // the path the party walks, along the middle of the ground
  if (sc !== 'quarry' && sc !== 'cave') path(p, seed, sc);
  if (sc === 'cave') caveFloor(p, seed);
  if (sc === 'quarry') gravel(p, seed);
  // grass blades, small far and longer near
  if (sc !== 'cave') {
    const blades = sc === 'quarry' ? 260 : 1400;
    for (const b of scatter(seed + 130, blades, HZ + 2, BACK_H, 0.75)) {
      if (sc === 'river' && b.y > HZ + 3 && b.y < HZ + 26) continue;
      const len = 0.5 + b.t * 3 + b.d;
      const c = b.d < 0.3 ? PAL.grassDark : b.d < 0.75 ? PAL.grassLight : PAL.grassTip;
      const lean = (b.d - 0.5) * 1.2;
      p.fline(b.x, b.y, b.x + lean, b.y - len, sc === 'woods' ? mixHex(c, PAL.dirtDark, 0.2) : c);
    }
  }
  // things on the ground, by place, small and hazed far off, bigger near
  const props: PixelArt[][] =
    sc === 'thicket'
      ? [set.flowers, set.tuft, set.bramble, set.bush, set.tallGrass, set.pebbles]
      : sc === 'river'
        ? [set.flowers, set.tuft, set.reeds, set.pebbles, set.tallGrass]
        : sc === 'woods'
          ? [set.fern, set.tuft, set.mushroom, set.fern, set.twig, set.tuft, set.flowers, set.fern, set.stump]
          : sc === 'quarry'
            ? [set.pebbles, set.tuft, set.pebbles, set.boulder, set.pebbles, set.tuft]
            : [];
  for (const b of scatter(seed + 140, sc === 'cave' ? 0 : 70, HZ + 6, BACK_H - 24, 0.9)) {
    const list = props[Math.floor(b.d * props.length)];
    const art = list[Math.floor(hash(seed, b.x, 141) * list.length)];
    put(p, art, b.x, b.y, b.t < 0.35 ? 0.5 : b.t < 0.75 ? 0.75 : 1, hash(seed, b.x, 142) < 0.5);
  }
}

function path(p: Painter, seed: number, sc: Scenery): void {
  const mid = HZ + 36;
  const edge = sc === 'woods' ? PAL.dirtDark : PAL.dirt;
  for (let x = 0; x < BACK_W; x++) {
    const centre = mid + Math.round((wave(seed + 150, x, 3) - 0.5) * 8);
    const half = 6 + Math.round(wave(seed + 151, x, 9) * 3);
    for (let y = centre - half; y <= centre + half; y++) {
      const t = Math.abs(y - centre) / half;
      let c = mixHex(PAL.dirtLight, edge, t * 0.8);
      // (two ruts worn in it)
      if (Math.abs(y - centre) === Math.round(half * 0.45)) c = shade(c, -0.12);
      p.px(x, y, c);
    }
    // a ragged verge of grass over its edges
    if (hash(seed, x, 152) < 0.6) p.px(x, centre - half, PAL.grassDark);
    if (hash(seed, x, 153) < 0.5) p.px(x, centre + half, PAL.grass);
  }
  // pebbles and puddles on it
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(hash(seed, k, 154) * BACK_W);
    const y = mid - 5 + Math.floor(hash(seed, k, 155) * 10);
    p.fpx(x, y, PAL.pebble);
    p.fpx(x + 0.5, y + 0.5, shade(PAL.pebble, -0.3));
  }
  for (let k = 0; k < 3; k++) {
    const x = Math.floor(hash(seed, k, 156) * BACK_W);
    oval(p, x, mid + 1, 5, 1, mixHex(PAL.water, SKY[sc][1], 0.4));
    p.rect(x - 2, mid, 2, 1, '#e8f4fc');
  }
}

function river(p: Painter, seed: number, set: SpriteSet): void {
  const top = HZ + 8;
  for (let x = 0; x < BACK_W; x++) {
    const a = top + Math.round((wave(seed + 160, x, 5) - 0.5) * 4);
    const b = a + 12 + Math.round(wave(seed + 161, x, 7) * 4);
    p.rect(x, a - 2, 1, 2, PAL.mud);
    for (let y = a; y < b; y++) p.px(x, y, mixHex(PAL.waterDark, PAL.water, (y - a) / (b - a)));
    p.rect(x, b, 1, 2, mixHex(PAL.mud, PAL.dirt, 0.4));
    // glints on the water, in short runs across the current
    if (hash(seed, x, 162) < 0.12) p.rect(x, a + 2 + Math.floor(hash(seed, x, 163) * (b - a - 4)), 2, 1, PAL.waterLight);
  }
  for (let k = 0; k < 16; k++) put(p, set.reeds[k % set.reeds.length], hash(seed, k, 164) * BACK_W, top + (k % 2 ? 0 : 16), 0.5 + (k % 2) * 0.25);
}

function gravel(p: Painter, seed: number): void {
  for (const b of scatter(seed + 170, 700, HZ + 3, BACK_H, 0.8)) {
    const c = b.d < 0.4 ? PAL.rockDark : b.d < 0.8 ? PAL.rockLight : PAL.rockTip;
    const s = 0.5 + b.t * 1.5;
    p.frect(b.x, b.y, s, s * 0.6, c);
  }
  // cart ruts across the yard
  for (let x = 0; x < BACK_W; x++) {
    const y = HZ + 34 + Math.round((wave(seed + 171, x, 3) - 0.5) * 6);
    p.px(x, y, PAL.dirtDark);
    p.px(x, y + 7, PAL.dirtDark);
  }
}

function caveFloor(p: Painter, seed: number): void {
  // cracks in the stone floor
  for (let k = 0; k < 24; k++) {
    let x = hash(seed, k, 180) * BACK_W;
    let y = HZ + 4 + hash(seed, k, 181) * (BACK_H - HZ - 8);
    for (let i = 0; i < 14; i++) {
      p.fpx(((x % BACK_W) + BACK_W) % BACK_W, y, '#141018');
      x += 0.8;
      y += hash(seed, k * 30 + i, 182) - 0.5;
    }
  }
  // still pools catching the glow
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(hash(seed, k, 183) * BACK_W);
    const y = HZ + 14 + Math.floor(hash(seed, k, 184) * 70);
    oval(p, x, y, 8 + k * 2, 2 + k * 0.4, '#1e2a3a');
    p.rect(x - 4, y - 1, 5, 1, '#5a7a9a');
  }
  // glowing mushrooms, bones, rubble
  for (const b of scatter(seed + 185, 40, HZ + 4, BACK_H - 10, 0.8)) {
    const s = 0.6 + b.t;
    if (b.d < 0.35) {
      const c = b.d < 0.17 ? '#7ae8c8' : '#c08ae8';
      p.frect(b.x, b.y - 2 * s, 0.5, 2 * s, '#d8d0c0');
      oval(p, b.x, b.y - 2 * s, 1.5 * s, 0.8 * s, c);
      p.ctx.globalAlpha = 0.2;
      oval(p, b.x, b.y - 2 * s, 5 * s, 4 * s, c);
      p.ctx.globalAlpha = 1;
    } else if (b.d < 0.5) {
      p.fline(b.x - 2 * s, b.y, b.x + 2 * s, b.y - 0.5, '#d8d0b8');
      p.fpx(b.x - 2 * s, b.y - 0.5, '#e8e0c8');
      p.fpx(b.x + 2 * s, b.y - 1, '#e8e0c8');
    } else {
      oval(p, b.x, b.y, 1.5 * s, 1 * s, '#3e3846');
      p.fpx(b.x - s * 0.5, b.y - s * 0.5, '#5a5262');
    }
  }
}

/** The near edge: a fringe of tall grass and bushes (or rock), dark against the light. */
function foreground(p: Painter, sc: Scenery, seed: number, set: SpriteSet): void {
  const y = FRONT_H;
  if (sc === 'cave') {
    for (let x = 0; x < BACK_W; x++) {
      const h = Math.round(4 + 14 * rough(seed + 190, x) ** 2);
      p.rect(x, y - h, 1, h, '#141018');
      p.px(x, y - h, '#2e2836');
    }
    return;
  }
  if (sc === 'quarry') {
    for (let k = 0; k < 5; k++) put(p, set.boulder[k % set.boulder.length], hash(seed, k, 191) * BACK_W, y + 6, 1);
    return;
  }
  const list = sc === 'woods' ? [...set.fern, ...set.bush] : sc === 'river' ? [...set.reeds, ...set.tallGrass] : [...set.bush, ...set.tallGrass, ...set.bramble];
  for (let k = 0; k < 16; k++) put(p, list[Math.floor(hash(seed, k, 192) * list.length)], (k / 16) * BACK_W + hash(seed, k, 193) * 14, y + 3, 1.25, k % 2 === 0);
  // (and a dark fringe of blades along the bottom)
  for (let x = 0; x < BACK_W; x += 0.5) {
    const h = 3 + hash(seed, Math.round(x * 2), 194) * 7;
    p.fline(x, y, x + (hash(seed, Math.round(x * 2), 195) - 0.5) * 2, y - h, hash(seed, Math.round(x * 2), 196) < 0.5 ? PAL.grassDark : shade(PAL.grassDark, -0.2));
  }
}
