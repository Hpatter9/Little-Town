// A building going up: a real construction site round the walls that rise from the ground (buildingsView masks the
// finished picture to the progress). Before work starts the plot is staked out with a string line and the materials
// pile up as they're delivered; once it starts, scaffolding climbs just ahead of the walls (uprights, ledgers at each
// lift, cross-braces, boards to stand on), with a ladder, a gin-pole hoist lifting its load up and down, and the site's
// gear about its feet (lumber stacked, stone or bricks, a mortar tub, a sawhorse, a wheelbarrow, crates and sacks). The
// era of what's built sets the kit: lashed poles in the Stone Age, timber, then steel tubes with couplers, and safety
// netting in the modern eras. Drawn with Graphics on the fine grid (half art pixels), through the layer's tone.

import type { Graphics } from 'pixi.js';
import type { Era } from '../../shared/data/eras';
import type { Material } from '../../shared/data/materials';
import type { Tone } from './pixelArt';

export interface Site {
  /** The building's picture: left, top, width, height (art px, on its layer). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Built so far (0..1); delivered so far of each material, and the whole cost. */
  progress: number;
  delivered: Partial<Record<Material, number>>;
  cost: Partial<Record<Material, number>>;
  era: Era;
  /** A number of the building's own, so its clutter sits the same way every time. */
  seed: number;
  now: number;
}

type Kit = { pole: string; poleDark: string; joint: string; board: string; boardDark: string; tube: boolean; net: boolean };
const KITS: Record<string, Kit> = {
  neolithic: { pole: '#8a6a44', poleDark: '#5a4028', joint: '#d8c08a', board: '#9a7a4c', boardDark: '#6a5030', tube: false, net: false },
  medieval: { pole: '#9a7448', poleDark: '#634526', joint: '#3a2a1a', board: '#c09058', boardDark: '#7a5632', tube: false, net: false },
  industrial: { pole: '#8a94a0', poleDark: '#4e565f', joint: '#2e3238', board: '#b88a52', boardDark: '#765430', tube: true, net: false },
  modern: { pole: '#a8b0b8', poleDark: '#5e666e', joint: '#e0b020', board: '#c89a5a', boardDark: '#7c5a34', tube: true, net: true },
};
const kitOf = (era: Era): Kit => (era === 'neolithic' ? KITS.neolithic : era === 'medieval' ? KITS.medieval : era === 'industrial' ? KITS.industrial : KITS.modern);

/** A small hash for where things lie (steady from one redraw to the next). */
const hh = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 1023) / 1023;
};

const WOOD: Material[] = ['wood', 'lumber'];
const STONE: Material[] = ['stone', 'bricks', 'clay', 'concrete'];

/** Draw the site into `g` (cleared by the caller). */
export function drawSite(g: Graphics, s: Site, tone: Tone): void {
  const c = (hex: string) => parseInt(tone(hex).slice(1, 7), 16);
  const rect = (x: number, y: number, w: number, h: number, hex: string, alpha = 1) => g.rect(x, y, w, h).fill({ color: c(hex), alpha });
  const line = (x0: number, y0: number, x1: number, y1: number, hex: string, width = 0.5) => g.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: c(hex), width });
  const kit = kitOf(s.era);
  const ground = s.y + s.h;
  const left = s.x - 3;
  const right = s.x + s.w + 2;

  // the plot, cleared and trodden
  rect(left - 2, ground - 0.5, right - left + 5, 1.5, '#5a4630', 0.55);

  if (s.progress <= 0) {
    // staked out: a stake at each corner, a string line between, a little flag
    for (const sx of [left, right]) {
      rect(sx, ground - 5, 1, 5, '#a07a4a');
      rect(sx, ground - 5, 1, 0.5, '#d8b880');
    }
    line(left + 0.5, ground - 4, right + 0.5, ground - 4, '#e8e0c8', 0.5);
    line(left + 0.5, ground - 1.5, right + 0.5, ground - 1.5, '#e8e0c8', 0.5);
    rect(right + 1, ground - 5, 3, 2, '#d8402a');
  } else {
    // ---------------------------------------------------------------- the scaffolding
    const built = s.h * s.progress;
    const top = Math.max(s.y - 2, ground - Math.min(s.h + 3, built + 9)); // (a lift above the work)
    const LIFT = 9;
    const bays = Math.max(1, Math.round((right - left) / 13));
    const bay = (right - left) / bays;
    const xs = Array.from({ length: bays + 1 }, (_, i) => left + i * bay);
    const lifts: number[] = [];
    for (let ly = ground - LIFT; ly >= top - 0.01; ly -= LIFT) lifts.push(ly);
    // safety netting first, behind the frame (the modern eras)
    if (kit.net && lifts.length) rect(left, top, right - left + 1, ground - top, '#3a9a5a', 0.22);
    // uprights
    for (const x of xs) {
      rect(x, top - 1, 1, ground - top + 1, kit.pole);
      rect(x + 0.5, top - 1, 0.5, ground - top + 1, kit.poleDark);
      rect(x - 0.5, ground - 0.5, 2, 0.5, kit.poleDark); // (a base plate)
    }
    // ledgers at each lift, braces in every other bay, joints lashed or coupled
    lifts.forEach((ly, li) => {
      rect(left, ly, right - left + 1, 0.5, kit.pole);
      for (let i = 0; i < bays; i++) {
        if ((i + li) % 2 === 0) line(xs[i] + 1, ly + LIFT, xs[i + 1], ly + 0.5, kit.poleDark, 0.5);
      }
      for (const x of xs) {
        if (kit.tube) rect(x - 0.5, ly - 0.5, 2, 1, kit.joint);
        else rect(x - 0.5, ly - 0.5, 1.5, 1, kit.joint); // (rope lashings)
      }
    });
    // boards: the working lift right across, the lower lifts at the ends
    lifts.forEach((ly, li) => {
      const working = li === lifts.length - 1;
      const spans: [number, number][] = working ? [[left, right + 1]] : [[left, left + bay], [right + 1 - bay, right + 1]];
      for (const [a, b] of spans) {
        rect(a, ly - 1, b - a, 1, kit.board);
        for (let bx = a + 3 + (li % 2) * 2; bx < b; bx += 5) rect(bx, ly - 1, 0.5, 1, kit.boardDark);
        if (working && kit.tube) rect(a, ly - 3, b - a, 0.5, '#e0b020'); // (a toe board and guard rail)
      }
    });
    // a ladder up the right-hand end
    const lx = right + 1.5;
    rect(lx, top - 1, 0.5, ground - top + 1, kit.poleDark);
    rect(lx + 2.5, top - 1, 0.5, ground - top + 1, kit.poleDark);
    for (let ry = ground - 1.5; ry > top; ry -= 2) rect(lx, ry, 3, 0.5, kit.pole);

    // the hoist: a gin pole on the left end with a jib, a pulley, and its load going up and down
    const gx = left;
    const gTop = top - 8;
    rect(gx, gTop, 1, top - gTop, kit.pole);
    rect(gx - 6, gTop, 7, 1, kit.pole);
    line(gx - 5.5, gTop + 1, gx + 0.5, gTop + 5, kit.poleDark, 0.5); // (a strut)
    g.circle(gx - 5.5, gTop + 1.5, 1).fill({ color: c('#3a3a3a') });
    const travel = Math.max(4, ground - gTop - 8);
    const load = gTop + 4 + travel * (0.5 + 0.5 * Math.sin(s.now / 1800 + s.seed));
    line(gx - 5.5, gTop + 2, gx - 5.5, load, '#e8e0c8', 0.5);
    const lifting = s.cost.stone || s.cost.bricks ? 'stone' : 'wood';
    if (lifting === 'stone') {
      rect(gx - 7.5, load, 4, 2.5, '#8a8682');
      rect(gx - 7.5, load, 4, 0.5, '#b4b0aa');
    } else {
      rect(gx - 8.5, load, 6, 1, '#b88a52');
      rect(gx - 8.5, load + 1, 6, 1, '#8a6232');
    }
    // and its hauling rope down to a stake beside the pole
    line(gx - 5.5, gTop + 1.5, gx - 2, ground - 2, '#e8e0c8', 0.5);
    rect(gx - 2.5, ground - 2.5, 1, 2.5, '#6a4a2a');
  }

  // ------------------------------------------------------------------ the site's gear, at its feet
  const has = (ms: Material[]) => ms.some((m) => (s.cost[m] ?? 0) > 0);
  const share = (ms: Material[]) => {
    const want = ms.reduce((n, m) => n + (s.cost[m] ?? 0), 0);
    return want ? Math.min(1, ms.reduce((n, m) => n + (s.delivered[m] ?? 0), 0) / want) * (1 - s.progress * 0.7) : 0;
  };
  let at = s.x + 1;
  const spot = (w: number) => {
    const x = at;
    at += w + 1.5;
    return at < s.x + s.w - 2 ? x : null;
  };
  // lumber: stacked planks or logs, as many as are waiting to be used
  if (has(WOOD)) {
    const n = Math.ceil(share(WOOD) * 5);
    const x = spot(12);
    if (x !== null && n) {
      for (let i = 0; i < n; i++) {
        rect(x + (i % 2) * 0.5, ground - 2 - i * 2, 12, 2, i % 2 ? '#a87a46' : '#c09058');
        rect(x + (i % 2) * 0.5, ground - 2 - i * 2, 12, 0.5, '#d8b07a');
        rect(x + 11.5 + (i % 2) * 0.5, ground - 2 - i * 2, 0.5, 2, '#f0d8a8'); // (sawn ends)
      }
      rect(x + 1, ground - 0.5, 1.5, 0.5, '#4a3420');
      rect(x + 9, ground - 0.5, 1.5, 0.5, '#4a3420');
    }
  }
  // stone or bricks, piled, and a mortar tub
  if (has(STONE)) {
    const n = Math.ceil(share(STONE) * 5);
    const brick = (s.cost.bricks ?? 0) > 0 || (s.cost.concrete ?? 0) > 0;
    const x = spot(11);
    if (x !== null && n) {
      for (let i = 0; i < n; i++) {
        const row = i < 3 ? 0 : i < 5 ? 1 : 2;
        const col = i < 3 ? i : i - 3;
        const bx = x + col * 3.5 + row * 1.7;
        const by = ground - 3 - row * 3;
        rect(bx, by, 3.5, 3, brick ? '#a8483a' : hh(s.seed, i) < 0.5 ? '#8a8682' : '#9c968e');
        rect(bx, by, 3.5, 0.5, brick ? '#c8665a' : '#bab4ac');
        rect(bx + 3, by, 0.5, 3, brick ? '#7a3028' : '#6a6662');
      }
    }
    const t = spot(4);
    if (t !== null && s.progress > 0) {
      rect(t, ground - 2.5, 4, 2.5, '#6a4a2a');
      rect(t + 0.5, ground - 2.5, 3, 0.5, '#c8c0b0'); // (mortar)
    }
  }
  // the rest (fiber, hides, metal, glass...) in crates, barrels and sacks
  const others = (Object.keys(s.cost) as Material[]).filter((m) => !WOOD.includes(m) && !STONE.includes(m) && (s.cost[m] ?? 0) > 0);
  others.slice(0, 2).forEach((m, i) => {
    if (!(s.delivered[m] ?? 0)) return;
    const x = spot(4);
    if (x === null) return;
    const kind = hh(s.seed, 7 + i);
    if (kind < 0.4) {
      rect(x, ground - 4, 4, 4, '#a07a4a');
      line(x, ground - 4, x + 4, ground, '#6a4a2a', 0.5);
      rect(x, ground - 4, 4, 0.5, '#c8a070');
    } else if (kind < 0.7) {
      rect(x + 0.5, ground - 4.5, 3, 4.5, '#7a5432');
      rect(x + 0.5, ground - 3.5, 3, 0.5, '#4a4a50');
      rect(x + 0.5, ground - 1.5, 3, 0.5, '#4a4a50');
    } else {
      g.ellipse(x + 2, ground - 1.6, 2, 1.6).fill({ color: c('#c8b48a') });
      rect(x + 1.5, ground - 3.5, 1, 0.5, '#8a7450');
    }
  });
  if (s.progress > 0) {
    // a sawhorse with a plank across (anything of wood), and a wheelbarrow by the right-hand end
    if (has(WOOD)) {
      const x = spot(6);
      if (x !== null) {
        line(x + 1, ground, x + 2, ground - 3, '#6a4a2a', 0.5);
        line(x + 3, ground, x + 2, ground - 3, '#6a4a2a', 0.5);
        line(x + 4, ground, x + 5, ground - 3, '#6a4a2a', 0.5);
        rect(x, ground - 3.5, 7, 0.5, '#c09058');
      }
    }
    const wx = s.x + s.w - 7;
    if (wx > at) {
      g.circle(wx + 1, ground - 1, 1).fill({ color: c('#3a3a3a') });
      g.poly([wx, ground - 3.5, wx + 5, ground - 3.5, wx + 4, ground - 1.5, wx + 1, ground - 1.5]).fill({ color: c(s.era === 'neolithic' ? '#8a6a44' : '#6a7078') });
      line(wx + 5, ground - 3, wx + 7, ground - 1.5, '#6a4a2a', 0.5);
      if (has(STONE)) rect(wx + 1, ground - 4.5, 3, 1, '#9c968e');
    }
  }
}
