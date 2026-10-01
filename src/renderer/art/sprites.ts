// Procedural placeholder sprites. Each generator makes one variant; SpriteSet holds several of each.

import { Rng } from '../../shared/rng';
import { PAL } from './palette';
import { paint, type Painter, type PixelArt, type Tone } from './pixelArt';
import { shade } from './terrain';

export interface SpriteSet {
  broadleaf: PixelArt[];
  pine: PixelArt[];
  bush: PixelArt[];
  boulder: PixelArt[];
  outcrop: PixelArt[];
  reeds: PixelArt[];
  tuft: PixelArt[];
  flowers: PixelArt[];
  /** What's left of a felled tree, a fallen log, ferns and toadstools for the forest floor. */
  stump: PixelArt[];
  log: PixelArt[];
  fern: PixelArt[];
  mushroom: PixelArt[];
  /** Small things underfoot: pebbles, twigs and a dropped branch, tall seeding grass, and bramble with its berries. */
  pebbles: PixelArt[];
  twig: PixelArt[];
  tallGrass: PixelArt[];
  bramble: PixelArt[];
}

export function makeSpriteSet(seed: number, tone: Tone): SpriteSet {
  const rng = new Rng(seed);
  const many = (n: number, f: (r: Rng) => PixelArt) => Array.from({ length: n }, () => f(rng));
  return {
    broadleaf: many(8, (r) => broadleafTree(r, tone)),
    pine: many(6, (r) => pineTree(r, tone)),
    bush: many(6, (r) => bush(r, tone)),
    boulder: many(6, (r) => boulder(r, tone)),
    outcrop: many(4, (r) => outcrop(r, tone)),
    reeds: many(5, (r) => reeds(r, tone)),
    tuft: many(8, (r) => tuft(r, tone)),
    flowers: many(12, (r) => flowers(r, tone)),
    stump: many(4, (r) => stump(r, tone)),
    log: many(3, (r) => fallenLog(r, tone)),
    fern: many(4, (r) => fern(r, tone)),
    mushroom: many(3, (r) => mushrooms(r, tone)),
    pebbles: many(6, (r) => pebbles(r, tone)),
    twig: many(4, (r) => twig(r, tone)),
    tallGrass: many(6, (r) => tallGrass(r, tone)),
    bramble: many(4, (r) => bramble(r, tone)),
  };
}

/** A small hash for fine detail that mustn't use up the sprite's random numbers (so shapes stay as they were). */
const fh = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 1023) / 1023;
};

/** Leaves on the fine grid over a crown: tiny two-tone leaves, lit up and to the left, shaded down and to the right. */
function fineLeaves(p: Painter, cx: number, cy: number, rx: number, ry: number, n: number, seed: number, deep: string): void {
  for (let i = 0; i < n; i++) {
    const a = fh(i, seed, 1) * Math.PI * 2;
    const d = Math.sqrt(fh(i, seed, 2));
    const x = cx + Math.cos(a) * d * rx;
    const y = cy + Math.sin(a) * d * ry;
    const up = (y - cy) / ry - (x - cx) / rx / 2; // (-: toward the light)
    const col = up < -0.35 ? (fh(i, seed, 3) < 0.5 ? PAL.leafTip : PAL.leafLight) : up > 0.45 ? deep : fh(i, seed, 3) < 0.5 ? PAL.leaf : PAL.leafDark;
    p.frect(x, y, 1, 0.5, col);
    p.fpx(x + (fh(i, seed, 4) < 0.5 ? 0 : 0.5), y - 0.5, col);
    if (up < 0) p.fpx(x, y + 0.5, PAL.leafDark); // (each leaf's own shadow)
  }
}

/** Bark: vertical grain lines and a knot or two down a trunk. */
function bark(p: Painter, rng: Rng, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < Math.max(2, w - 2); i++) {
    const gx = x + 1 + rng.int(0, Math.max(0, w - 3));
    const gy = y + rng.int(0, Math.max(0, h - 6));
    p.rect(gx, gy, 1, rng.int(3, 7), PAL.trunkDark);
  }
  // (finer furrows between, and a pale ridge beside each)
  for (let fx = x + 1.5; fx < x + w - 1; fx += 1.5)
    for (let fy = y + fh(fx * 2, y, 9) * 4; fy < y + h - 2; fy += 3 + fh(fx * 2, fy, 8) * 3) {
      p.frect(fx, fy, 0.5, 1.5, PAL.trunkDark);
      p.frect(fx - 0.5, fy, 0.5, 1, PAL.trunkLight);
    }
  if (h > 10 && rng.chance(0.7)) {
    const ky = y + rng.int(2, h - 6);
    p.rect(x + Math.floor(w / 2) - 1, ky, 2, 2, PAL.trunkDark);
    p.px(x + Math.floor(w / 2) - 1, ky, PAL.trunkLight);
  }
}

function broadleafTree(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(46, 64);
  const h = rng.int(72, 106);
  return paint(w, h, tone, (p) => {
    const cx = Math.floor(w / 2);
    const trunkW = rng.int(5, 8);
    const trunkTop = Math.floor(h * 0.4);
    // trunk with root flare, a lit left edge, bark and roots
    p.rect(cx - trunkW / 2, trunkTop, trunkW, h - trunkTop, PAL.trunk);
    bark(p, rng, cx - trunkW / 2, trunkTop + 4, trunkW, h - trunkTop - 6);
    p.rect(cx - trunkW / 2, trunkTop, 1, h - trunkTop, PAL.trunkLight);
    p.rect(cx + trunkW / 2 - 1, trunkTop, 1, h - trunkTop, PAL.trunkDark);
    p.rect(cx - trunkW / 2 - 3, h - 2, trunkW + 6, 2, PAL.trunkDark);
    p.rect(cx - trunkW / 2 - 2, h - 3, trunkW + 4, 1, PAL.trunk);
    p.rect(cx - trunkW / 2 - 1, h - 4, trunkW + 2, 1, PAL.trunk);
    p.px(cx - trunkW / 2 - 3, h - 3, PAL.trunkLight);
    // two branches
    for (const bSide of [-1, 1]) {
      if (bSide === 1 && rng.chance(0.4)) continue;
      const by = trunkTop + rng.int(4, 10);
      for (let i = 0; i < 8; i++) p.rect(cx + bSide * (trunkW / 2 + i), by - i, 2, 2, i < 3 ? PAL.trunk : PAL.trunkDark);
    }
    // canopy: shadow, dark base blobs, mid-tone, light highlights up and to the left, then leaf clusters
    const cy = Math.floor(h * 0.36);
    const R = Math.floor(w * 0.37);
    const blobs = Array.from({ length: 8 }, () => ({ x: cx + rng.range(-R * 0.65, R * 0.65), y: cy + rng.range(-R * 0.55, R * 0.45), r: rng.range(R * 0.45, R * 0.72) }));
    blobs.push({ x: cx, y: cy, r: R * 0.8 });
    const deep = shade(PAL.leafDark, -0.25);
    for (const b of blobs) p.disc(b.x + 1, b.y + 3, b.r, deep);
    for (const b of blobs) p.disc(b.x, b.y + 1, b.r - 1, PAL.leafDark);
    for (const b of blobs) p.disc(b.x - 1, b.y - 1, b.r - 3, PAL.leaf);
    for (const b of blobs) if (b.y < cy + 3) p.disc(b.x - 3, b.y - 3, Math.max(2, b.r - 7), PAL.leafLight);
    // leaf clusters: little three-pixel sprays in every tone, so the crown reads as leaves, not a blob
    for (let i = 0; i < 70; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, R * 0.95);
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d * 0.82);
      const col = y < cy - R * 0.2 ? (rng.chance(0.6) ? PAL.leafTip : PAL.leafLight) : y > cy + R * 0.3 ? deep : rng.chance(0.5) ? PAL.leafDark : PAL.leafLight;
      p.px(x, y, col);
      p.px(x + 1, y, col);
      p.px(x, y - 1, col);
    }
    fineLeaves(p, cx, cy, R, R * 0.82, 260, w * 31 + h, deep);
    // a gap or two in the crown, the sky showing through, with a branch across it
    if (rng.chance(0.5)) {
      const gx = cx + rng.int(-R / 2, R / 2);
      const gy = cy + rng.int(-2, R / 3);
      p.rect(gx, gy, 3, 2, deep);
      p.rect(gx - 1, gy + 1, 5, 1, PAL.trunkDark);
    }
    if (rng.chance(0.3)) for (let i = 0; i < 5; i++) p.px(cx + rng.int(-R * 0.7, R * 0.7), cy + rng.int(-R * 0.3, R * 0.5), '#c9453b'); // fruit
  });
}

function pineTree(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(30, 42);
  const h = rng.int(82, 116);
  return paint(w, h, tone, (p) => {
    const cx = Math.floor(w / 2);
    p.rect(cx - 2, h - 18, 4, 18, PAL.trunk);
    p.rect(cx - 2, h - 18, 1, 18, PAL.trunkLight);
    p.rect(cx + 1, h - 18, 1, 18, PAL.trunkDark);
    p.rect(cx - 4, h - 2, 8, 2, PAL.trunkDark);
    const tiers = rng.int(4, 6);
    const top = 2;
    const bottom = h - 12;
    const tierH = (bottom - top) / tiers;
    const deep = shade(PAL.pineDark, -0.25);
    for (let t = 0; t < tiers; t++) {
      const y0 = top + t * tierH * 0.85;
      const rows = tierH * 1.35;
      const maxHalf = (w / 2 - 1) * (0.45 + (0.55 * (t + 1)) / tiers);
      for (let r = 0; r < rows; r++) {
        const half = Math.max(1, Math.round((maxHalf * (r + 1)) / rows));
        const y = y0 + r;
        p.rect(cx - half, y, half * 2, 1, PAL.pine);
        p.rect(cx, y, half, 1, PAL.pineDark);
        p.rect(cx - half, y, Math.max(1, Math.floor(half * 0.4)), 1, PAL.pineLight);
        // needles: the edge of each row ragged, and flecks in the body
        if (half > 3 && rng.chance(0.5)) p.px(cx - half - 1, y, PAL.pine);
        if (half > 3 && rng.chance(0.5)) p.px(cx + half, y, PAL.pineDark);
        if (half > 4 && rng.chance(0.35)) p.px(cx + rng.int(-half + 1, half - 2), y, rng.chance(0.5) ? PAL.pineLight : deep);
        // needles on the fine grid: little slanting tufts along the row, lit on the left
        for (let nx = -half; nx < half; nx += 1.5) if (fh(nx * 2 + 99, y * 2, w) < 0.4) p.frect(cx + nx, y + 0.5, 0.5, 0.5, nx < -half * 0.3 ? PAL.pineLight : nx > half * 0.3 ? deep : PAL.pineDark);
        p.fpx(cx - half - 0.5, y + 0.5, PAL.pine);
        p.fpx(cx + half, y + 0.5, PAL.pineDark);
      }
      // drooping dark fringe along the bottom of the tier, and the shadow it casts on the tier below
      for (let x = -maxHalf; x < maxHalf; x += 3) p.rect(cx + x, y0 + rows, 2, 1, PAL.pineDark);
      p.rect(cx - maxHalf * 0.6, y0 + rows + 1, maxHalf * 1.2, 1, deep);
    }
    if (rng.chance(0.4)) for (let i = 0; i < 4; i++) p.rect(cx + rng.int(-w / 4, w / 4), rng.int(h * 0.3, h * 0.75), 1, 2, PAL.trunk); // cones
  });
}

function bush(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(20, 32);
  const h = rng.int(13, 20);
  return paint(w, h, tone, (p) => {
    const n = rng.int(3, 5);
    const deep = shade(PAL.leafDark, -0.25);
    for (let i = 0; i < n; i++) {
      const x = 6 + ((w - 12) * i) / (n - 1);
      const r = rng.range(5, 7.5);
      p.ellipse(x + 1, h - r + 1, r + 1, r, deep);
      p.ellipse(x, h - r, r + 1, r, PAL.leafDark);
      p.ellipse(x - 1, h - r - 1, r - 1, r - 2, PAL.leaf);
      p.rect(x - 3, h - r * 2 + 2, 3, 1, PAL.leafLight);
    }
    for (let i = 0; i < 16; i++) p.px(rng.int(2, w - 3), rng.int(2, h - 3), rng.chance(0.5) ? PAL.leafLight : deep);
    fineLeaves(p, w / 2, h * 0.55, w / 2 - 2, h * 0.42, 70, w * 17 + h, deep);
    p.rect(2, h - 1, w - 4, 1, deep);
    if (rng.chance(0.5)) for (let i = 0; i < 5; i++) p.px(rng.int(3, w - 4), rng.int(h - 12, h - 4), rng.chance(0.7) ? '#c9453b' : '#4a3a8a');
  });
}

function boulder(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(18, 34);
  const h = rng.int(13, 24);
  return paint(w, h, tone, (p) => {
    const rx = w / 2 - 1;
    const ry = h / 2;
    p.ellipse(w / 2, h - ry, rx, ry, PAL.rockDark);
    p.ellipse(w / 2 - 1, h - ry - 1, rx - 2, ry - 2, PAL.rock);
    p.ellipse(w / 2 - 3, h - ry - 3, rx * 0.5, ry * 0.45, PAL.rockLight);
    p.rect(w / 2 - rx * 0.4, h - ry * 2 + 3, 3, 1, PAL.rockTip);
    // facets, grain, cracks and moss
    for (let i = 0; i < 10; i++) p.px(rng.int(3, w - 4), rng.int(h - ry * 2 + 3, h - 3), rng.chance(0.5) ? PAL.rockLight : PAL.rockDark);
    for (let i = 0; i < 3; i++) {
      let x = rng.int(4, w - 8);
      let y = rng.int(h - ry, h - 4);
      for (let k = 0; k < 4; k++, x++, y += rng.int(-1, 1)) p.px(x, y, shade(PAL.rockDark, -0.2));
    }
    // on the fine grid: hairline cracks, a sparkle of mica, and pits
    for (let i = 0; i < 4; i++) {
      let x = 3 + fh(i, w, 1) * (w - 8);
      let y = h - ry * 1.6 + fh(i, h, 2) * ry;
      for (let k = 0; k < 8; k++, x += 0.5, y += fh(i, k, 3) < 0.5 ? 0.5 : 0) p.fpx(x, y, shade(PAL.rockDark, -0.3));
    }
    for (let i = 0; i < 14; i++) p.fpx(3 + fh(i, w, 4) * (w - 6), h - ry * 1.8 + fh(i, h, 5) * ry * 1.6, fh(i, 1, 6) < 0.5 ? PAL.rockTip : shade(PAL.rockDark, -0.15));
    if (rng.chance(0.7)) for (let i = 0; i < 7; i++) p.rect(rng.int(3, w - 5), h - rng.int(2, 5), 2, 1, rng.chance(0.5) ? PAL.moss : PAL.grass);
    p.rect(2, h - 1, w - 4, 1, shade(PAL.rockDark, -0.3));
  });
}

function stump(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(9, 13);
  const h = rng.int(6, 9);
  return paint(w, h, tone, (p) => {
    p.rect(1, 2, w - 2, h - 2, PAL.trunk);
    p.rect(1, 2, 1, h - 2, PAL.trunkLight);
    p.rect(w - 2, 2, 1, h - 2, PAL.trunkDark);
    p.rect(0, h - 2, w, 2, PAL.trunkDark); // roots
    // the cut face, with its rings
    p.ellipse(w / 2, 2, w / 2 - 1, 1.5, '#c8a070');
    p.rect(Math.floor(w / 2) - 1, 1, 2, 1, '#9a7448');
    if (rng.chance(0.5)) p.rect(2, h - 3, 2, 1, PAL.moss);
  });
}

function fallenLog(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(20, 28);
  return paint(w, 7, tone, (p) => {
    p.rect(2, 1, w - 4, 5, PAL.trunk);
    p.rect(2, 1, w - 4, 1, PAL.trunkLight);
    p.rect(2, 5, w - 4, 1, PAL.trunkDark);
    for (let x = 4; x < w - 5; x += rng.int(3, 5)) p.px(x, rng.int(2, 4), PAL.trunkDark);
    p.ellipse(w - 3, 3.5, 2, 2.5, '#c8a070');
    p.px(w - 3, 3, '#9a7448');
    for (let i = 0; i < 4; i++) p.rect(rng.int(3, w - 6), 1, 2, 1, PAL.moss);
    if (rng.chance(0.6)) p.rect(rng.int(4, w - 8), 0, 1, 1, '#d84a3a'); // a toadstool on top
  });
}

function fern(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(11, 15);
  const h = rng.int(7, 10);
  return paint(w, h, tone, (p) => {
    const cx = Math.floor(w / 2);
    for (const side of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const len = h - 1 - f;
        for (let i = 0; i < len; i++) {
          const x = cx + side * Math.round((i * (f + 2)) / 3);
          const y = h - 1 - i + Math.round((i * i) / (len * 2));
          p.px(x, y, i > len - 3 ? PAL.leafLight : f === 1 ? PAL.leaf : PAL.leafDark);
        }
      }
    }
  });
}

function mushrooms(rng: Rng, tone: Tone): PixelArt {
  const cap = rng.pick(['#c83a2a', '#b8864a', '#e8dcc0']);
  return paint(10, 6, tone, (p) => {
    for (const [x, s] of [[2, 1], [6, 0]] as [number, number][]) {
      p.rect(x, 3 - s, 1, 3 + s, '#e8e0cc');
      p.rect(x - 1 - s, 2 - s, 3 + s * 2, 1, cap);
      p.rect(x - s, 1 - s, 1 + s * 2, 1, cap);
      if (cap === '#c83a2a') p.px(x - s, 2 - s, '#f4f0e4');
    }
  });
}

function outcrop(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(40, 56);
  const h = rng.int(34, 46);
  return paint(w, h, tone, (p) => {
    const stones = [
      { x: w * 0.3, y: h - 11, rx: 13, ry: 11 },
      { x: w * 0.68, y: h - 9, rx: 12, ry: 9 },
      { x: w * 0.48, y: h - 22, rx: 11, ry: 13 },
      { x: w * 0.55, y: h - 32, rx: 6, ry: 6 },
    ];
    for (const s of stones) p.ellipse(s.x, s.y, s.rx, s.ry, PAL.rockDark);
    for (const s of stones) p.ellipse(s.x - 1, s.y - 1, s.rx - 2, s.ry - 2, PAL.rock);
    for (const s of stones) p.ellipse(s.x - 3, s.y - 3, s.rx * 0.45, s.ry * 0.4, PAL.rockLight);
    for (let i = 0; i < 6; i++) p.rect(rng.int(4, w - 6), rng.int(8, h - 3), rng.int(2, 5), 1, PAL.rockDark);
    for (let i = 0; i < 6; i++) p.rect(rng.int(4, w - 6), h - rng.int(2, 5), 2, 1, PAL.moss);
  });
}

function reeds(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(12, 18);
  const h = rng.int(16, 24);
  return paint(w, h, tone, (p) => {
    for (let x = 1; x < w - 1; x += rng.int(1, 3)) {
      const bladeH = rng.int(Math.floor(h * 0.5), h - 1);
      const lean = rng.pick([-1, 0, 0, 1]);
      for (let y = 0; y < bladeH; y++) p.px(x + (y > bladeH * 0.6 ? lean : 0), h - 1 - y, y > bladeH * 0.7 ? PAL.reedLight : PAL.reed);
      if (rng.chance(0.3)) p.rect(x, h - bladeH - 1, 2, 4, PAL.cattail);
    }
  });
}

function tuft(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(5, 9);
  const h = rng.int(3, 6);
  return paint(w, h, tone, (p) => {
    for (let x = 0; x < w; x += 2) {
      const bh = rng.int(1, h);
      p.rect(x, h - bh, 1, bh, rng.chance(0.5) ? PAL.grassLight : PAL.grass);
      if (bh === h) p.px(x, h - bh, PAL.grassTip);
    }
  });
}

function flowers(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(7, 11);
  const h = rng.int(4, 7);
  const color = rng.pick(PAL.flowers);
  return paint(w, h, tone, (p) => {
    for (let x = 1; x < w - 1; x += rng.int(2, 3)) {
      const sh = rng.int(2, h - 1);
      p.rect(x, h - sh, 1, sh, PAL.grass);
      p.px(x, h - sh - 1, color);
    }
  });
}

/** A scatter of pebbles, lit on top. */
function pebbles(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(6, 12);
  return paint(w, 3, tone, (p) => {
    for (let k = rng.int(3, 6); k > 0; k--) {
      const x = rng.int(0, w - 2);
      const big = rng.chance(0.35);
      p.rect(x, big ? 1 : 2, big ? 2 : 1, big ? 2 : 1, rng.chance(0.5) ? PAL.rock : PAL.rockDark);
      p.px(x, big ? 1 : 2, PAL.rockLight);
    }
  });
}

/** A dropped branch or a few twigs, a leaf or two still on. */
function twig(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(7, 13);
  return paint(w, 4, tone, (p) => {
    const y0 = rng.int(1, 3);
    for (let x = 0; x < w; x++) p.px(x, Math.max(0, Math.min(3, y0 + Math.round(Math.sin(x / 2.5) * 0.8))), x % 3 ? PAL.trunk : PAL.trunkDark);
    for (let k = rng.int(1, 2); k > 0; k--) {
      const x = rng.int(2, w - 3);
      p.px(x, 0, PAL.trunkLight);
      p.px(x + 1, 1, PAL.trunk);
    }
    if (rng.chance(0.6)) p.px(rng.int(1, w - 2), 0, rng.chance(0.5) ? PAL.leaf : PAL.leafDark);
  });
}

/** Tall grass gone to seed: long blades, some bent over, with pale seed heads. */
function tallGrass(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(6, 10);
  const h = rng.int(8, 13);
  return paint(w, h, tone, (p) => {
    for (let x = 0; x < w; x += 1 + (rng.chance(0.4) ? 1 : 0)) {
      const bh = rng.int(Math.floor(h / 2), h);
      const lean = rng.chance(0.35) ? (rng.chance(0.5) ? 1 : -1) : 0;
      for (let y = 0; y < bh; y++) p.px(Math.max(0, Math.min(w - 1, x + (y > bh * 0.6 ? lean : 0))), h - 1 - y, y > bh * 0.7 ? PAL.grassLight : rng.chance(0.3) ? PAL.grassDark : PAL.grass);
      if (bh > h * 0.75) p.rect(Math.max(0, Math.min(w - 1, x + lean)), h - bh, 1, 2, PAL.grassTip);
    }
  });
}

/** A bramble: a tangle of thorny stems and dark leaves, with berries (red, or ripe and dark). */
function bramble(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(12, 18);
  const h = rng.int(7, 10);
  const berry = rng.pick(['#b8283a', '#3a1c4a', '#7a1c3a']);
  return paint(w, h, tone, (p) => {
    for (let k = 0; k < 4; k++) {
      let x = rng.int(0, w - 1);
      for (let y = h - 1; y > rng.int(1, 3); y--) {
        p.px(x, y, PAL.trunkDark);
        x = Math.max(0, Math.min(w - 1, x + rng.int(-1, 1)));
      }
    }
    for (let k = 0; k < w * 2; k++) p.px(rng.int(0, w - 1), rng.int(1, h - 2), rng.chance(0.6) ? PAL.leafDark : PAL.leaf);
    for (let k = rng.int(3, 6); k > 0; k--) p.px(rng.int(1, w - 2), rng.int(2, h - 3), berry);
  });
}

/** Stake with a yellow flag: marks a tile for gathering. */
export function markerFlag(tone: Tone): PixelArt {
  return paint(12, 18, tone, (p) => {
    p.rect(2, 1, 2, 17, PAL.trunkDark);
    p.rect(2, 1, 1, 17, PAL.trunkLight);
    for (let y = 0; y < 7; y++) {
      const w = 8 - Math.abs(y - 3) * 2;
      p.rect(4, 1 + y, w, 1, y < 3 ? '#ffe070' : '#e8b830');
    }
    p.rect(4, 4, 7, 1, '#c89420');
  });
}

/** Animated campfire: stone ring, crossed logs, flickering flames. */
export function campfireFrames(rng: Rng, tone: Tone): PixelArt[] {
  const w = 30;
  const h = 30;
  return Array.from({ length: 4 }, (_, frame) =>
    paint(w, h, tone, (p) => {
      // flames first so logs and stones overlap their base
      const flame = (x: number, baseW: number, height: number, color: string) => {
        for (let y = 0; y < height; y++) {
          const half = Math.max(0, Math.round((baseW / 2) * (1 - y / height) ** 0.8));
          const sway = Math.round(Math.sin((y + frame * 3) * 0.5) * (y / height) * 1.5);
          if (half > 0) p.rect(x - half + sway, h - 8 - y, half * 2, 1, color);
        }
      };
      const f = (base: number, jitter: number) => base + rng.int(-jitter, jitter);
      flame(15, 14, f(18, 2), PAL.flameRed);
      flame(15, 10, f(14, 2), PAL.flameOrange);
      flame(14 + rng.int(0, 2), 5, f(8, 2), PAL.flameYellow);
      flame(10, 5, f(8, 2), PAL.flameOrange);
      flame(20, 5, f(8, 2), PAL.flameOrange);
      for (let i = 0; i < 2; i++) p.px(rng.int(9, 21), h - rng.int(22, 28), PAL.ember);
      // logs
      p.rect(5, h - 8, 20, 3, PAL.trunk);
      p.rect(5, h - 8, 20, 1, PAL.trunkLight);
      p.rect(8, h - 6, 14, 2, PAL.trunkDark);
      p.rect(12, h - 6, 6, 1, PAL.ember);
      // stone ring
      for (const x of [2, 7, 13, 19, 25]) {
        p.ellipse(x + 2, h - 3, 3, 2.4, PAL.rockDark);
        p.rect(x + 1, h - 5, 2, 1, PAL.rockLight);
      }
    }),
  );
}
