// The Nomad Caravan's own buildings (see sim/nomads.ts). While the tribe wanders, everything that goes on the wagons
// looks it: work under awnings, a striped bazaar pavilion for the shop (a bigger one at each upgrade), a many-peaked
// feast tent for the tavern, a horse line for the stable, a stockpile that is a laden cart. Once the tribe settles in
// the Industrial age its home ground becomes a caravan city: the same buildings built again in adobe, with domes,
// arcades and awnings over the doors. (Homes and walls are in originStyles.ts; the city's homes are here too.)

import { mixHex, type Painter } from './pixelArt';

type Draw = (p: Painter, w: number, h: number) => void;

const FELT = '#e0d0b0';
const FELT_DARK = '#c0ae8c';
const FELT_LIGHT = '#ecdcc0';
const RED = '#b83a2a';
const RED_DARK = '#7a2a1e';
const BLUE = '#3a6ac8';
const GOLD = '#e8c040';
const POLE = '#6a4a2a';
const POLE_DARK = '#3a2a1a';
const ROPE = '#a89470';
const SHADE = '#3a2a1c';
const ADOBE = '#d8b888';
const ADOBE_DARK = '#b89868';
const ADOBE_LIGHT = '#e8cca0';
const DOME = '#e8dcc8';
const DOME_DARK = '#c8b8a0';
const TEAL = '#3a8a8a';

/* ------------------------------------------------------------ tent parts */

function pole(p: Painter, x: number, top: number, bottom: number): void {
  p.rect(x, top, 2, bottom - top, POLE);
  p.rect(x, top, 1, bottom - top, '#8a6a3a');
}

function pennant(p: Painter, x: number, top: number, color: string): void {
  p.rect(x, top - 10, 1, 11, POLE_DARK);
  for (let i = 0; i < 4; i++) p.rect(x + 1, top - 10 + i, 7 - i * 1.6, 1, color);
  for (let i = 0; i < 3; i++) p.rect(x + 1, top - 6 + i, 4 - i * 1.3, 1, color);
}

/** A peaked roof from x0..x1 down to `base` from a point at `peak`, in stripes of two colours. */
function peak(p: Painter, x0: number, x1: number, base: number, top: number, a: string, b: string, stripe = 6): void {
  const mid = (x0 + x1) / 2;
  for (let y = top; y <= base; y++) {
    const half = (((y - top) / Math.max(1, base - top)) * (x1 - x0)) / 2;
    for (let x = Math.floor(mid - half); x < mid + half; x++) p.px(x, y, Math.floor((x - x0) / stripe) % 2 ? a : b);
    // (seams between the stripes, stitched on the fine grid)
    if (y % 2 === 0) for (let x = x0 + stripe; x < x1; x += stripe) if (Math.abs(x - mid) < half) p.fpx(x - 0.5, y, mixHex(a, '#000000', 0.35));
  }
  p.rect(mid - 0.5, top - 3, 1, 4, POLE_DARK);
}

/** A scalloped valance along the front of a canopy. */
function valance(p: Painter, x0: number, x1: number, y: number, color: string): void {
  p.rect(x0, y, x1 - x0, 2, color);
  for (let x = x0; x < x1; x += 6) p.disc(x + 3, y + 2, 2, color);
  for (let x = x0 + 0.5; x < x1; x += 1.5) p.fpx(x, y + 0.5, mixHex(color, '#ffffff', 0.3)); // (a stitched hem)
  for (let x = x0; x < x1; x += 6) p.fpx(x + 3, y + 4, GOLD); // (a tassel at each scallop)
}

/** A flat awning on poles, with room to work underneath. */
function awning(p: Painter, x0: number, x1: number, top: number, bottom: number, a: string, b: string): void {
  for (let y = 0; y < 5; y++) for (let x = x0; x < x1; x++) p.px(x, top + y, Math.floor((x - x0) / 6) % 2 ? a : b);
  valance(p, x0, x1, top + 5, a);
  pole(p, x0 + 1, top + 5, bottom);
  pole(p, x1 - 3, top + 5, bottom);
  // guy ropes to pegs
  p.rect(x0 - 3, top + 4, 1, 1, ROPE);
  for (let i = 0; i < 6; i++) p.px(x0 - i * 0.6, top + 5 + i * ((bottom - top - 5) / 6), ROPE);
  for (let i = 0; i < 6; i++) p.px(x1 - 1 + i * 0.6, top + 5 + i * ((bottom - top - 5) / 6), ROPE);
}

/** A walled tent: felt walls hung with a band and a door flap, under peaked roofs (one per `peaks`). */
function pavilion(p: Painter, w: number, h: number, wallH: number, peaks: number, a: string, b: string, door = true): void {
  const base = h - wallH;
  p.rect(2, base, w - 4, wallH, FELT);
  for (let x = 2; x < w - 2; x += 8) p.rect(x, base, 4, wallH, FELT_LIGHT);
  p.rect(2, base + 2, w - 4, 2, a);
  p.rect(2, h - 3, w - 4, 1, FELT_DARK);
  // (felt on the fine grid: stitches along the band, and the weave of the cloth)
  for (let x = 2.5; x < w - 2; x += 2) p.frect(x, base + 2.5, 1, 0.5, mixHex(a, '#ffffff', 0.35));
  for (let y = base + 5; y < h - 3; y += 1.5) for (let x = 3 + ((y * 2) % 2); x < w - 3; x += 3) p.fpx(x, y, mixHex(FELT, '#000000', 0.12));
  const each = (w - 4) / peaks;
  for (let i = 0; i < peaks; i++) {
    const x0 = 2 + i * each;
    const tall = peaks > 1 && i === Math.floor(peaks / 2) ? 10 : 0;
    peak(p, x0 - 2, x0 + each + 2, base + 1, base - 16 - tall - Math.min(10, each / 6), a, b);
    pennant(p, Math.round(x0 + each / 2), base - 18 - tall - Math.min(10, each / 6), i % 2 ? BLUE : GOLD);
  }
  if (door) {
    p.rect(w / 2 - 6, h - Math.min(18, wallH), 12, Math.min(18, wallH), SHADE);
    p.rect(w / 2 - 7, h - Math.min(18, wallH), 3, Math.min(18, wallH), a); // the flap tied back
    p.rect(w / 2 - 6, h - Math.min(18, wallH), 12, 1, GOLD);
  }
}

function rug(p: Painter, x: number, y: number, w: number, h: number, a: string, b: string): void {
  p.rect(x, y, w, h, a);
  p.rect(x + 1, y + 1, w - 2, h - 2, b);
  for (let k = y + 2; k < y + h - 2; k += 3) p.rect(x + 2, k, w - 4, 1, a);
  for (let k = x; k < x + w; k += 2) p.px(k, y + h, GOLD);
  for (let k = x + 0.5; k < x + w; k += 1) p.frect(k, y + h, 0.5, 1.5, k % 2 < 1 ? a : GOLD); // (a finer fringe)
}

function pot(p: Painter, x: number, y: number, color: string): void {
  p.ellipse(x, y - 3, 3, 3, color);
  p.rect(x - 1, y - 7, 2, 2, color);
}

function bundle(p: Painter, x: number, y: number, w: number, color: string): void {
  p.rect(x, y - 6, w, 6, color);
  p.rect(x, y - 4, w, 1, ROPE);
  p.rect(x + w / 2, y - 6, 1, 6, ROPE);
}

function cart(p: Painter, x: number, base: number, w: number): void {
  p.rect(x, base - 12, w, 5, POLE);
  p.rect(x, base - 12, w, 1, '#8a6a3a');
  for (const cx of [x + 5, x + w - 6]) {
    p.disc(cx, base - 4, 4, POLE_DARK);
    p.disc(cx, base - 4, 2, POLE);
  }
  p.rect(x + w, base - 10, 8, 1, POLE_DARK); // the shafts
}

/* ------------------------------------------------------------ the camp */

const TENTS: Record<string, { h: number; draw: Draw }> = {
  // work under an awning: a bench and its tools
  workbench: {
    h: 44,
    draw: (p, w, h) => {
      awning(p, 4, w - 4, h - 34, h, RED, FELT);
      p.rect(12, h - 12, w - 24, 3, POLE); // the bench
      p.rect(14, h - 9, 2, 9, POLE_DARK);
      p.rect(w - 16, h - 9, 2, 9, POLE_DARK);
      p.rect(18, h - 15, 6, 3, '#8a8a90'); // tools on it
      p.rect(30, h - 14, 8, 2, '#a07a4a');
      for (const x of [16, 24, 32]) p.rect(x, h - 26, 1, 6, '#8a8a90'); // and hung from the awning
    },
  },
  loom: {
    h: 44,
    draw: (p, w, h) => {
      awning(p, 4, w - 4, h - 34, h, BLUE, FELT);
      p.rect(14, h - 24, 2, 24, POLE); // the loom's frame
      p.rect(w - 16, h - 24, 2, 24, POLE);
      p.rect(14, h - 24, w - 28, 2, POLE);
      for (let x = 17; x < w - 17; x += 2) p.rect(x, h - 22, 1, 14, x % 4 ? RED : GOLD);
      p.rect(16, h - 8, w - 32, 4, RED_DARK); // the cloth so far
    },
  },
  tannery: {
    h: 46,
    draw: (p, w, h) => {
      awning(p, 4, w - 4, h - 36, h, RED_DARK, FELT_DARK);
      for (const x of [14, 40]) {
        p.rect(x, h - 26, 1, 26, POLE); // a stretching frame and its hide
        p.rect(x + 16, h - 26, 1, 26, POLE);
        p.ellipse(x + 8, h - 15, 7, 9, '#a88258');
        p.ellipse(x + 8, h - 15, 5, 7, '#c8a276');
      }
      p.rect(w - 26, h - 10, 14, 10, POLE_DARK); // a vat
      p.rect(w - 25, h - 10, 12, 2, '#6a5a3a');
    },
  },
  hunters_lodge: {
    h: 54,
    draw: (p, w, h) => {
      peak(p, 6, w - 6, h - 1, 8, '#a88258', '#8a6a44', 8);
      p.rect(w / 2 - 6, h - 20, 12, 20, SHADE);
      p.rect(w / 2 - 7, h - 20, 3, 20, '#c8a276');
      // antlers over the smoke hole, a haunch hung to cure
      for (const d of [-1, 1]) {
        p.rect(w / 2 + d * 2, 2, 1, 6, '#e0d0b0');
        p.rect(w / 2 + d * 4, 1, 1, 3, '#e0d0b0');
        p.rect(w / 2 + d * 6, 3, 1, 3, '#e0d0b0');
      }
      p.rect(w - 14, h - 26, 1, 10, ROPE);
      p.ellipse(w - 14, h - 13, 3, 5, '#a8423a');
      rug(p, 8, h - 4, 18, 3, RED, '#c85030');
    },
  },
  storytellers_circle: {
    h: 42,
    draw: (p, w, h) => {
      // a round canopy on a centre pole, cushions in a ring beneath
      pole(p, w / 2 - 1, 12, h);
      for (let y = 0; y < 12; y++) {
        const half = 6 + y * 3.2;
        p.rect(w / 2 - half, 12 + y, half * 2, 1, y % 3 ? FELT : BLUE);
      }
      valance(p, w / 2 - 44, w / 2 + 44, 24, BLUE);
      for (let i = 0; i < 5; i++) p.ellipse(14 + i * ((w - 28) / 4), h - 3, 5, 3, [RED, GOLD, BLUE, RED, GOLD][i]);
      p.ellipse(w / 2, h - 2, 4, 2, '#f08030'); // a little fire
      p.rect(w / 2 - 1, h - 6, 2, 3, '#f0c040');
    },
  },
  healers_hut: {
    h: 50,
    draw: (p, w, h) => {
      peak(p, 4, w - 4, h - 1, 10, '#f0ece0', '#dcd4c4', 7);
      p.rect(w / 2 - 5, h - 16, 10, 16, SHADE);
      p.rect(w / 2 - 1, 18, 2, 8, RED); // a red cross on the white
      p.rect(w / 2 - 4, 21, 8, 2, RED);
      for (const x of [8, w - 12]) {
        p.rect(x, h - 12, 1, 6, ROPE); // bundles of herbs drying
        p.rect(x - 2, h - 7, 5, 4, '#6a9a4a');
      }
    },
  },
  // the bazaar: a stall, then a two-peaked pavilion, then a grand one
  trading_post: {
    h: 54,
    draw: (p, w, h) => {
      awning(p, 4, w - 4, h - 38, h, RED, FELT_LIGHT);
      p.rect(10, h - 12, w - 20, 12, POLE); // the counter, hung with a rug
      rug(p, 16, h - 11, w - 32, 8, RED_DARK, RED);
      pot(p, 18, h - 12, '#b0704a');
      pot(p, 28, h - 12, '#3a6ac8');
      bundle(p, w - 30, h - 12, 10, '#c8b894');
      rug(p, w - 20, h - 32, 10, 14, BLUE, '#5a8ae8'); // one for sale, hung up
    },
  },
  general_store: {
    h: 62,
    draw: (p, w, h) => {
      pavilion(p, w, h, 26, 2, RED, FELT_LIGHT);
      rug(p, 8, h - 22, 14, 16, BLUE, '#5a8ae8');
      rug(p, w - 22, h - 22, 14, 16, RED_DARK, RED);
      pot(p, 30, h - 2, '#b0704a');
      pot(p, w - 30, h - 2, '#3a8a8a');
    },
  },
  emporium: {
    h: 72,
    draw: (p, w, h) => {
      pavilion(p, w, h, 30, 3, RED, GOLD);
      for (const x of [8, 28, w - 42, w - 22]) rug(p, x, h - 26, 14, 18, x < w / 2 ? BLUE : RED_DARK, x < w / 2 ? '#5a8ae8' : RED);
      for (const x of [48, w - 52]) {
        p.rect(x, h - 30, 1, 8, POLE_DARK); // lanterns
        p.disc(x, h - 20, 2, GOLD);
      }
    },
  },
  // the feast tent: great, and greater
  fireside_inn: {
    h: 60,
    draw: (p, w, h) => {
      pavilion(p, w, h, 24, 1, RED_DARK, FELT);
      p.disc(w / 2 - 20, h - 26, 2, GOLD); // lanterns at the door
      p.disc(w / 2 + 20, h - 26, 2, GOLD);
      p.rect(w / 2 + 10, 8, 3, 6, '#8a8a8a'); // smoke from the roof
    },
  },
  tavern: {
    h: 74,
    draw: (p, w, h) => {
      pavilion(p, w, h, 28, 3, RED_DARK, FELT, false);
      // the front rolled up on a feast: tables and a cask inside
      p.rect(w / 2 - 30, h - 22, 60, 22, SHADE);
      p.rect(w / 2 - 26, h - 10, 52, 3, POLE);
      for (let x = w / 2 - 22; x < w / 2 + 22; x += 8) p.rect(x, h - 13, 2, 3, GOLD);
      p.ellipse(w / 2 + 20, h - 5, 5, 5, POLE);
      p.rect(w / 2 - 30, h - 23, 60, 2, GOLD);
      for (const x of [w / 2 - 40, w / 2 + 40]) p.disc(x, h - 30, 2, GOLD);
    },
  },
  // the horse line: posts, a rope, hay and a shade
  stable: {
    h: 44,
    draw: (p, w, h) => {
      awning(p, w - 44, w - 4, h - 34, h, FELT_DARK, FELT);
      for (let x = 6; x < w - 46; x += 18) pole(p, x, h - 22, h);
      p.rect(6, h - 20, w - 50, 1, ROPE);
      for (const x of [w - 38, w - 24]) {
        p.rect(x, h - 10, 12, 10, '#d8c060'); // hay bales
        p.rect(x, h - 6, 12, 1, '#a89040');
      }
      p.rect(10, h - 6, 16, 5, POLE_DARK); // a trough
      p.rect(11, h - 6, 14, 2, '#4a7aa8');
    },
  },
  barracks: {
    h: 58,
    draw: (p, w, h) => {
      pavilion(p, w, h, 24, 2, RED_DARK, RED);
      for (const x of [8, w - 16]) {
        p.rect(x, h - 20, 8, 10, '#6a1a1a'); // shields on the walls
        p.disc(x + 4, h - 15, 2, GOLD);
      }
      for (let x = w / 2 - 14; x < w / 2 + 16; x += 6) p.rect(x, h - 34, 1, 34, '#8a8a90'); // a rack of spears
    },
  },
  // a tall pole with a lookout's perch and a great pennant
  lookout: {
    h: 84,
    draw: (p, w, h) => {
      pole(p, w / 2 - 1, 10, h);
      p.rect(w / 2 - 12, 26, 24, 3, POLE);
      p.rect(w / 2 - 12, 18, 2, 8, POLE);
      p.rect(w / 2 + 10, 18, 2, 8, POLE);
      p.rect(w / 2 - 12, 18, 24, 1, ROPE);
      for (let i = 0; i < 8; i++) p.rect(w / 2 + 1, 2 + i, 18 - i * 2, 1, RED);
      for (let y = 30; y < h; y += 6) p.rect(w / 2 - 4, y, 8, 1, POLE_DARK); // footholds
      for (let i = 0; i < 10; i++) {
        p.px(w / 2 - 6 - i * 2, 22 + i * 6, ROPE);
        p.px(w / 2 + 6 + i * 2, 22 + i * 6, ROPE);
      }
    },
  },
  // the stockpile is a laden cart and the bundles off it
  stockpile: {
    h: 32,
    draw: (p, w, h) => {
      cart(p, 4, h, 40);
      bundle(p, 6, h - 12, 12, '#c8b894');
      bundle(p, 20, h - 12, 12, '#a88258');
      bundle(p, 12, h - 18, 12, '#d8c8a8');
      for (let i = 0; i < 3; i++) p.ellipse(60 + i * 10, h - 5, 5, 5, ['#c8b894', '#a88258', '#8a9448'][i]); // sacks
      p.rect(w - 22, h - 14, 16, 14, '#6a4a2a'); // a chest
      p.rect(w - 22, h - 14, 16, 2, GOLD);
    },
  },
  market: {
    h: 44,
    draw: (p, w, h) => {
      awning(p, 2, w / 2 - 1, h - 34, h, BLUE, FELT_LIGHT);
      awning(p, w / 2 + 1, w - 2, h - 30, h, RED, FELT_LIGHT);
      rug(p, 8, h - 10, 30, 6, RED_DARK, RED);
      for (let i = 0; i < 4; i++) pot(p, w / 2 + 10 + i * 9, h - 2, ['#b0704a', '#3a6ac8', '#c8a040', '#3a8a8a'][i]);
    },
  },
};

/* ------------------------------------------------------------ the caravan city */

function adobeWall(p: Painter, x0: number, x1: number, top: number, bottom: number): void {
  p.rect(x0, top, x1 - x0, bottom - top, ADOBE);
  p.rect(x0, top, 2, bottom - top, ADOBE_LIGHT);
  p.rect(x1 - 2, top, 2, bottom - top, ADOBE_DARK);
  for (let y = top + 6; y < bottom; y += 9) for (let x = x0 + ((y / 9) % 2 ? 3 : 8); x < x1 - 3; x += 14) p.rect(x, y, 3, 1, ADOBE_DARK);
  // (mud plaster on the fine grid: straw flecks and hairline cracks)
  for (let y = top + 2; y < bottom - 1; y += 2.5) for (let x = x0 + 2 + ((y * 3) % 5); x < x1 - 2; x += 5) p.frect(x, y, 1, 0.5, (x + y) % 3 < 1 ? ADOBE_DARK : ADOBE_LIGHT);
  for (let x = x0 + 9; x < x1 - 4; x += 23) p.fline(x, top + 3, x + 1.5, top + 9, ADOBE_DARK);
  p.rect(x0 - 1, top - 2, x1 - x0 + 2, 2, ADOBE_LIGHT); // the parapet
  for (let x = x0 + 4; x < x1 - 2; x += 10) p.rect(x, top - 4, 4, 2, ADOBE_LIGHT);
}

function dome(p: Painter, cx: number, base: number, r: number, color = DOME, dark = DOME_DARK): void {
  for (let dy = 0; dy <= r; dy++) {
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)));
    p.rect(cx - half, base - dy, half, 1, color);
    p.rect(cx, base - dy, half, 1, dark);
    if (dy > r * 0.3 && dy < r * 0.85) p.frect(cx - half * 0.6, base - dy, 1, 0.5, mixHex(color, '#ffffff', 0.3)); // (a glint)
  }
  p.rect(cx - 0.5, base - r - 5, 1, 5, GOLD);
  p.disc(cx, base - r - 6, 1, GOLD);
}

function arch(p: Painter, x: number, y: number, w: number, h: number, color: string): void {
  p.rect(x, y + w / 2, w, h - w / 2, color);
  for (let i = 0; i < w / 2; i++) {
    const inset = Math.round(w / 2 - Math.sqrt((w / 2) ** 2 - (w / 2 - i - 0.5) ** 2));
    p.rect(x + inset, y + i, w - inset * 2, 1, color);
  }
}

/** A striped cloth awning over a door or a row of arches. */
function cityAwning(p: Painter, x0: number, x1: number, y: number, a: string, b: string): void {
  for (let k = 0; k < 4; k++) for (let x = x0; x < x1; x++) p.px(x, y + k, Math.floor((x - x0) / 5) % 2 ? a : b);
  valance(p, x0, x1, y + 4, a);
}

/** An adobe building of the caravan city: walls, arched doors and windows, maybe domes and an arcade. */
function adobe(p: Painter, w: number, h: number, o: { wallH: number; domes?: number; arcade?: boolean; awning?: [string, string]; tower?: boolean }): void {
  const top = h - o.wallH;
  if (o.domes) for (let i = 0; i < o.domes; i++) dome(p, ((i + 0.5) * w) / o.domes, top - 1, Math.min(14, w / o.domes / 2 - 3), i % 2 && o.domes > 1 ? TEAL : DOME, i % 2 && o.domes > 1 ? '#2a6a6a' : DOME_DARK);
  adobeWall(p, 2, w - 2, top, h);
  if (o.arcade) {
    for (let x = 8; x < w - 14; x += 16) arch(p, x, h - 20, 10, 20, SHADE);
  } else arch(p, w / 2 - 6, h - 18, 12, 18, '#5a3a24');
  for (let x = 10; x < w - 10; x += 22) if (Math.abs(x + 3 - w / 2) > 10) arch(p, x, top + 6, 6, 9, '#3a2a2a');
  if (o.awning) cityAwning(p, o.arcade ? 6 : w / 2 - 12, o.arcade ? w - 6 : w / 2 + 12, h - (o.arcade ? 26 : 24), o.awning[0], o.awning[1]);
  if (o.tower) {
    adobeWall(p, w - 16, w - 4, top - 22, top + 2);
    dome(p, w - 10, top - 25, 6, TEAL, '#2a6a6a');
  }
}

const CITY: Record<string, { h: number; draw: Draw }> = {
  workbench: { h: 42, draw: (p, w, h) => adobe(p, w, h, { wallH: 28, awning: [RED, FELT] }) },
  loom: { h: 42, draw: (p, w, h) => adobe(p, w, h, { wallH: 28, awning: [BLUE, FELT] }) },
  tannery: { h: 44, draw: (p, w, h) => adobe(p, w, h, { wallH: 30, awning: [RED_DARK, FELT_DARK] }) },
  hunters_lodge: { h: 48, draw: (p, w, h) => adobe(p, w, h, { wallH: 32, domes: 1 }) },
  storytellers_circle: { h: 52, draw: (p, w, h) => adobe(p, w, h, { wallH: 28, domes: 1, arcade: true }) },
  healers_hut: { h: 50, draw: (p, w, h) => adobe(p, w, h, { wallH: 30, domes: 1, awning: [RED, '#f0ece0'] }) },
  trading_post: { h: 50, draw: (p, w, h) => adobe(p, w, h, { wallH: 32, arcade: true, awning: [RED, FELT_LIGHT] }) },
  general_store: { h: 60, draw: (p, w, h) => adobe(p, w, h, { wallH: 34, domes: 1, arcade: true, awning: [BLUE, FELT_LIGHT] }) },
  emporium: { h: 76, draw: (p, w, h) => adobe(p, w, h, { wallH: 38, domes: 3, arcade: true, awning: [RED, GOLD], tower: true }) },
  fireside_inn: { h: 58, draw: (p, w, h) => adobe(p, w, h, { wallH: 34, domes: 1, awning: [RED_DARK, FELT] }) },
  tavern: { h: 72, draw: (p, w, h) => adobe(p, w, h, { wallH: 38, domes: 2, arcade: true, awning: [RED_DARK, GOLD] }) },
  stable: { h: 44, draw: (p, w, h) => adobe(p, w, h, { wallH: 30, arcade: true }) },
  barracks: { h: 56, draw: (p, w, h) => adobe(p, w, h, { wallH: 36, tower: true }) },
  lookout: { h: 84, draw: (p, w, h) => { adobeWall(p, w / 2 - 12, w / 2 + 12, 20, h); arch(p, w / 2 - 4, 26, 8, 12, '#3a2a2a'); arch(p, w / 2 - 5, h - 16, 10, 16, '#5a3a24'); dome(p, w / 2, 16, 10, TEAL, '#2a6a6a'); } },
  stockpile: { h: 34, draw: (p, w, h) => { adobeWall(p, 2, w - 2, h - 22, h); cityAwning(p, 4, w - 4, h - 26, BLUE, FELT_LIGHT); for (let i = 0; i < 5; i++) p.ellipse(12 + i * 16, h - 5, 6, 5, ['#c8b894', '#a88258', '#8a9448', '#d8c8a8', '#b0704a'][i]); } },
  market: { h: 44, draw: (p, w, h) => { adobeWall(p, 2, w - 2, h - 26, h); cityAwning(p, 4, w - 4, h - 22, RED, FELT_LIGHT); for (let i = 0; i < 4; i++) pot(p, 14 + i * 18, h - 2, ['#b0704a', '#3a6ac8', '#c8a040', '#3a8a8a'][i]); } },
};

/** The city's homes: adobe houses with domes, from a hut to a block of houses round a courtyard. */
export function cityHome(p: Painter, w: number, h: number, size: number): void {
  adobe(p, w, h, { wallH: [20, 26, 28, 44][size], domes: size >= 3 ? 2 : 1, awning: size >= 1 ? [size % 2 ? BLUE : RED, FELT] : undefined, tower: size >= 3 });
}

/** A Nomad Caravan's own art for a building (null: as usual): its tent while the tribe wanders, its adobe once it has
 *  settled into a caravan city. */
export function nomadArt(defId: string, city: boolean): { h: number; draw: Draw } | null {
  return (city ? CITY[defId] : TENTS[defId]) ?? null;
}
