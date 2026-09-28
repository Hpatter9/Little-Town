// Procedural placeholder sprites. Each generator makes one variant; SpriteSet holds several of each.

import { Rng } from '../../shared/rng';
import { PAL } from './palette';
import { paint, type PixelArt, type Tone } from './pixelArt';

export interface SpriteSet {
  broadleaf: PixelArt[];
  pine: PixelArt[];
  bush: PixelArt[];
  boulder: PixelArt[];
  outcrop: PixelArt[];
  reeds: PixelArt[];
  tuft: PixelArt[];
  flowers: PixelArt[];
}

export function makeSpriteSet(seed: number, tone: Tone): SpriteSet {
  const rng = new Rng(seed);
  const many = (n: number, f: (r: Rng) => PixelArt) => Array.from({ length: n }, () => f(rng));
  return {
    broadleaf: many(6, (r) => broadleafTree(r, tone)),
    pine: many(5, (r) => pineTree(r, tone)),
    bush: many(4, (r) => bush(r, tone)),
    boulder: many(5, (r) => boulder(r, tone)),
    outcrop: many(3, (r) => outcrop(r, tone)),
    reeds: many(4, (r) => reeds(r, tone)),
    tuft: many(6, (r) => tuft(r, tone)),
    flowers: many(4, (r) => flowers(r, tone)),
  };
}

function broadleafTree(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(46, 62);
  const h = rng.int(72, 104);
  return paint(w, h, tone, (p) => {
    const cx = Math.floor(w / 2);
    const trunkW = rng.int(5, 7);
    const trunkTop = Math.floor(h * 0.4);
    // trunk with root flare and a lit left edge
    p.rect(cx - trunkW / 2, trunkTop, trunkW, h - trunkTop, PAL.trunk);
    p.rect(cx - trunkW / 2, trunkTop, 1, h - trunkTop, PAL.trunkLight);
    p.rect(cx + trunkW / 2 - 1, trunkTop, 1, h - trunkTop, PAL.trunkDark);
    p.rect(cx - trunkW / 2 - 2, h - 3, trunkW + 4, 3, PAL.trunkDark);
    p.rect(cx - trunkW / 2 - 1, h - 4, trunkW + 2, 1, PAL.trunk);
    // a side branch
    const bSide = rng.pick([-1, 1]);
    for (let i = 0; i < 7; i++) p.rect(cx + bSide * (trunkW / 2 + i), trunkTop + 8 - i, 2, 2, PAL.trunk);
    // canopy: dark base blobs, mid-tone, then light highlights up and to the left
    const cy = Math.floor(h * 0.36);
    const R = Math.floor(w * 0.36);
    const blobs = Array.from({ length: 6 }, () => ({ x: cx + rng.range(-R * 0.6, R * 0.6), y: cy + rng.range(-R * 0.5, R * 0.4), r: rng.range(R * 0.5, R * 0.75) }));
    blobs.push({ x: cx, y: cy, r: R * 0.8 });
    for (const b of blobs) p.disc(b.x, b.y + 2, b.r, PAL.leafDark);
    for (const b of blobs) p.disc(b.x - 1, b.y, b.r - 3, PAL.leaf);
    for (const b of blobs) if (b.y < cy + 2) p.disc(b.x - 3, b.y - 3, Math.max(2, b.r - 8), PAL.leafLight);
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, R * 0.9);
      p.rect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 2, 1, rng.chance(0.5) ? PAL.leafTip : PAL.leafDark);
    }
  });
}

function pineTree(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(30, 40);
  const h = rng.int(82, 112);
  return paint(w, h, tone, (p) => {
    const cx = Math.floor(w / 2);
    p.rect(cx - 2, h - 18, 4, 18, PAL.trunk);
    p.rect(cx - 2, h - 18, 1, 18, PAL.trunkLight);
    const tiers = rng.int(4, 5);
    const top = 2;
    const bottom = h - 12;
    const tierH = (bottom - top) / tiers;
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
      }
      // drooping dark fringe along the bottom of the tier
      for (let x = -maxHalf; x < maxHalf; x += 3) p.rect(cx + x, y0 + rows, 2, 1, PAL.pineDark);
    }
  });
}

function bush(rng: Rng, tone: Tone): PixelArt {
  const w = rng.int(20, 30);
  const h = rng.int(13, 19);
  return paint(w, h, tone, (p) => {
    const n = rng.int(3, 4);
    for (let i = 0; i < n; i++) {
      const x = 6 + ((w - 12) * i) / (n - 1);
      const r = rng.range(5, 7);
      p.ellipse(x, h - r, r + 1, r, PAL.leafDark);
      p.ellipse(x - 1, h - r - 1, r - 1, r - 2, PAL.leaf);
      p.rect(x - 3, h - r * 2 + 2, 3, 1, PAL.leafLight);
    }
    if (rng.chance(0.5)) for (let i = 0; i < 4; i++) p.px(rng.int(3, w - 4), rng.int(h - 12, h - 4), '#c9453b');
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
    // cracks and moss
    for (let i = 0; i < 3; i++) p.rect(rng.int(4, w - 6), rng.int(h - ry, h - 4), rng.int(2, 4), 1, PAL.rockDark);
    if (rng.chance(0.6)) for (let i = 0; i < 5; i++) p.rect(rng.int(3, w - 5), h - rng.int(2, 4), 2, 1, PAL.moss);
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
