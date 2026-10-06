// Farmland seen from above (the owner's ask: the Fields tileset's soil read as dry desert dirt, and no pack has proper
// tilled fields): dark, moist loam turned into ridges and furrows across the plot, a bank of turned earth round its
// edge with grass creeping over it, clods and stones in the furrows; and the crop standing along the ridges by kind and
// stage: wheat in tufts that grow into stalks and turn gold with heavy heads, leafy vegetables that head up and show
// their roots' colour, flax with its sky-blue flowers, herbs in mixed clumps with little blooms, and an orchard's
// trees from whips to round shaded crowns in fruit. Painted on the fine grid (2 canvas px an art px) by `paintFarm`.

import type { CropLook } from './buildings';

type G = CanvasRenderingContext2D;

const LOAM = '#4a3323';
const LOAM_DEEP = '#36251a';
const RIDGE = '#654530';
const RIDGE_LIT = '#7a5639';
const RIDGE_TOP = '#8b6542';
const BANK = '#5a3f2a';
const GRASS = ['#5f8a34', '#6e9a3c', '#83ad48', '#4f7a2c'];

/** A little seeded stream, so a plot looks the same each time it's painted. */
function stream(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 7;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

/** Paint a field of `W` x `H` art px on `g` (scaled `k` canvas px an art px). `material` is the crop's
 *  (grain, vegetables, fiber, herbs, fruit), `orchard` for trees. */
export function paintFarm(g: G, k: number, W: number, H: number, material: string, orchard: boolean, stage: CropLook | undefined, seed: number, winter = false): void {
  const r = stream(seed);
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  };
  // (fine: half an art pixel, the fine grid's own)
  const dot = (x: number, y: number, c: string) => rect(x, y, 0.5, 0.5, c);

  // the loam
  rect(0, 0, W, H, LOAM);
  // ridges across the plot, a furrow between each: lit along the top, shaded below (an orchard's ground is grassed)
  const PITCH = 6;
  const rows: number[] = [];
  if (!orchard) {
    for (let y = 4; y < H - 4; y += PITCH) {
      rows.push(y);
      rect(2, y - 2, W - 4, 4, RIDGE);
      rect(2, y - 2, W - 4, 1, RIDGE_LIT);
      rect(2, y - 2, W - 4, 0.5, RIDGE_TOP);
      rect(2, y + 1.5, W - 4, 0.5, LOAM_DEEP);
      rect(2, y + 2, W - 4, 2, LOAM);
      rect(2, y + 3, W - 4, 1, LOAM_DEEP);
    }
    // clods, stones and the odd glint of wet earth
    for (let i = 0; i < (W * H) / 9; i++) {
      const x = 2 + r() * (W - 4);
      const y = 2 + r() * (H - 4);
      const c = r();
      dot(x, y, c < 0.45 ? LOAM_DEEP : c < 0.85 ? RIDGE_LIT : c < 0.95 ? '#8a7f70' : '#a08a6a');
    }
  } else {
    // an orchard stands in grass, mown between the trees
    rect(0, 0, W, H, '#56813a');
    for (let i = 0; i < (W * H) / 6; i++) dot(r() * W, r() * H, GRASS[Math.floor(r() * GRASS.length)]);
  }
  // the bank of turned earth round the edge, and grass creeping over it
  rect(0, 0, W, 1.5, BANK);
  rect(0, H - 1.5, W, 1.5, BANK);
  rect(0, 0, 1.5, H, BANK);
  rect(W - 1.5, 0, 1.5, H, BANK);
  rect(0, H - 0.5, W, 0.5, LOAM_DEEP);
  for (let i = 0; i < (W + H) * 1.2; i++) {
    const side = Math.floor(r() * 4);
    const t = r();
    const x = side < 2 ? t * W : side === 2 ? r() * 1.5 : W - r() * 1.5;
    const y = side >= 2 ? t * H : side === 0 ? r() * 1.5 : H - r() * 1.5;
    const c = GRASS[Math.floor(r() * GRASS.length)];
    rect(x, y - 1, 0.5, 1.5, c);
    if (r() < 0.4) dot(x + 0.5, y - 1.5, c);
  }
  if (winter) {
    // a dusting of frost along the ridges
    for (const y of rows) for (let x = 2; x < W - 2; x += 1 + r() * 2) dot(x, y - 2, '#e8eef4');
  }
  if (!stage || stage === 'fallow') {
    // fallow: a few weeds come up in the furrows
    for (let i = 0; i < (W * H) / 140; i++) {
      const x = 4 + r() * (W - 8);
      const y = rows.length ? rows[Math.floor(r() * rows.length)] + 2 : 4 + r() * (H - 8);
      rect(x, y - 1, 0.5, 1, '#6e8a3a');
      dot(x + 0.5, y - 1.5, '#82a048');
    }
    return;
  }

  if (orchard) return trees(rect, dot, r, W, H, stage);
  const plant = PLANTS[material] ?? PLANTS.grain;
  // along each ridge, a plant every few px, jittered
  const step = material === 'vegetables' ? 6 : material === 'herbs' ? 5 : 3;
  for (const y of rows)
    for (let x = 4 + r() * 2; x < W - 4; x += step + r() * (step / 2)) plant(rect, dot, x, y, stage, r);
}

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;
type Dot = (x: number, y: number, c: string) => void;
/** A round blob of radius `rad` (art px) about (x, y), on the fine grid, flattened a little (`squash`) as seen from the
 *  map's angle. */
function disc(rect: Rect, x: number, y: number, rad: number, c: string, squash = 0.85): void {
  for (let dy = -rad; dy <= rad; dy += 0.5) {
    const half = Math.sqrt(Math.max(0, rad * rad - dy * dy));
    if (half < 0.25) continue;
    rect(x - half, y + dy * squash, half * 2, 0.5, c);
  }
}
type Plant = (rect: Rect, dot: Dot, x: number, y: number, stage: CropLook, r: () => number) => void;

/** How tall a plant stands by its stage (art px). */
const HEIGHT: Record<CropLook, number> = { fallow: 0, sprout: 1.5, young: 3, tall: 5, heading: 6.5, ripe: 7 };

const PLANTS: Record<string, Plant> = {
  // wheat: green blades, then stalks with heads, gold when ripe, bending
  grain(rect, dot, x, y, stage, r) {
    const h = HEIGHT[stage] * (0.85 + r() * 0.3);
    const ripe = stage === 'ripe';
    const stalk = ripe ? '#c79a3c' : stage === 'heading' ? '#7fa83e' : '#6a9a36';
    const lit = ripe ? '#e6c25a' : '#93c050';
    const blades = stage === 'sprout' ? 2 : 3;
    for (let b = 0; b < blades; b++) {
      const bx = x + (b - 1) * 0.5;
      const lean = ripe ? 0.5 : 0;
      rect(bx + lean * b, y - h, 0.5, h, b === 1 ? lit : stalk);
    }
    if (stage === 'heading' || ripe) {
      const head = ripe ? '#e8c050' : '#a8c060';
      rect(x - 0.5 + (ripe ? 1 : 0), y - h - 1.5, 1, 2, head);
      dot(x + (ripe ? 1 : 0), y - h - 2, ripe ? '#f4dc84' : '#c0d878');
      dot(x - 0.5 + (ripe ? 1 : 0), y - h + 0.5, ripe ? '#a87a2a' : '#6a8a30');
    }
    // its shadow on the furrow
    rect(x - 0.5, y + 0.5, 1.5, 0.5, 'rgba(20,12,6,0.45)');
  },
  // vegetables: leafy rosettes that fill out; cabbages head up pale, and roots show their colour at the base when ripe
  vegetables(rect, dot, x, y, stage, r) {
    const s = { fallow: 0, sprout: 0.8, young: 1.4, tall: 2, heading: 2.3, ripe: 2.6 }[stage];
    const kind = Math.floor(r() * 3);
    disc(rect, x + 0.5, y + 0.3, s, 'rgba(20,12,6,0.45)', 0.5);
    disc(rect, x, y - s * 0.6, s, '#3f7a34');
    disc(rect, x - 0.3, y - s * 0.75, s * 0.75, '#5a9a40');
    if (kind === 0 && s >= 2) {
      disc(rect, x, y - s * 0.65, s * 0.55, '#a8d070');
      dot(x - 0.5, y - s, '#d8f0a8');
    } else {
      dot(x - s * 0.5, y - s, '#8cc85c');
      if (stage === 'ripe' || stage === 'heading') rect(x - 0.5, y - 0.5, 1, 1, kind === 1 ? '#e07a2a' : '#9a3a6a');
    }
  },
  // flax: thin straight stalks, sky-blue flowers on top, the stems going tan when ripe
  fiber(rect, dot, x, y, stage, r) {
    const h = HEIGHT[stage] * (0.9 + r() * 0.25);
    const ripe = stage === 'ripe';
    rect(x, y - h, 0.5, h, ripe ? '#b89a5a' : '#6e9e44');
    rect(x + 0.5, y - h + 1, 0.5, h - 1, ripe ? '#cdb070' : '#8abc58');
    if (stage === 'heading') {
      rect(x - 0.5, y - h - 1, 1.5, 1, '#7aa0e8');
      dot(x, y - h - 1.5, '#b8d0ff');
    } else if (ripe) dot(x, y - h - 0.5, '#8a7040');
    rect(x - 0.5, y + 0.5, 1.5, 0.5, 'rgba(20,12,6,0.4)');
  },
  // herbs: mixed clumps, some with little purple or white flowers
  herbs(rect, dot, x, y, stage, r) {
    const s = { fallow: 0, sprout: 0.7, young: 1.2, tall: 1.7, heading: 2, ripe: 2.2 }[stage];
    const greens = ['#5a9a50', '#7ab060', '#4a8a6a', '#8ab86a'];
    const c = greens[Math.floor(r() * greens.length)];
    disc(rect, x + 0.5, y + 0.3, s, 'rgba(20,12,6,0.45)', 0.5);
    disc(rect, x, y - s * 0.6, s, c);
    disc(rect, x - 0.4, y - s * 0.8, s * 0.6, '#a0d080');
    if (stage === 'heading' || stage === 'ripe') {
      const bloom = r() < 0.5 ? '#b088d8' : '#f0f0e0';
      dot(x - 0.5, y - s * 1.4, bloom);
      dot(x + 0.5, y - s * 1.1, bloom);
    }
  },
};

/** An orchard's trees in rows: whips, then young trees, then round crowns lit from the top left, with fruit. */
function trees(rect: Rect, dot: Dot, r: () => number, W: number, H: number, stage: CropLook): void {
  const gap = 12;
  for (let y = 11; y < H - 2; y += gap)
    for (let x = 7 + ((y / gap) % 2) * 5; x < W - 5; x += gap) {
      const s = { fallow: 0, sprout: 0.5, young: 1.6, tall: 2.6, heading: 2.9, ripe: 3.2 }[stage];
      // its shadow, cast to the lower right, then the trunk and the crown lit from the top left
      disc(rect, x + 1.2, y - 0.5, Math.max(0.8, s), 'rgba(16,24,8,0.45)', 0.5);
      rect(x, y - 2 - s, 0.5, 2 + s, '#5a3a22');
      if (s < 1) continue;
      const cy = y - 2.5 - s * 1.6;
      disc(rect, x, cy, s, '#2f6a2c');
      disc(rect, x - s * 0.15, cy - s * 0.15, s * 0.82, '#3f8436');
      disc(rect, x - s * 0.35, cy - s * 0.35, s * 0.45, '#58a046');
      dot(x - s * 0.5, cy - s * 0.5, '#7cc060');
      if (stage === 'heading') for (let i = 0; i < 3; i++) dot(x - s + r() * s * 2, cy - s + r() * s * 1.6, '#f4e8f0');
      if (stage === 'ripe') for (let i = 0; i < 4; i++) rect(x - s * 0.8 + r() * s * 1.6, cy - s * 0.7 + r() * s * 1.3, 1, 1, i % 2 ? '#e04a3a' : '#f0a030');
    }
}
