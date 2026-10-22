// The starting valleys drawn by hand (the owner's ask: hand-made maps of the game's special places): a river valley, a
// ruin to rebuild, a mountain shelf, a coastal cove. Each is drawn in `maps/start-valleys.ldtk` (one level a valley)
// and turned by `node tools/ldtk-maps.mjs` into `data/startValleys.ts`. When a town is founded from the New town panel
// (`NewGameOptions.valleys`) on a land a valley is drawn for (`biomes`), with a scenario it suits (`scenarios`; none:
// any), it is picked from a side stream ('valley', by the seed) `HAND_VALLEY_SHARE` of the time, and laid over the
// generated land round the camp (`makeLand`): its `Camp` on the camp's cell, its ground over the land's wherever it
// says (an empty cell keeps the land's own, so its edges blend into the land round it), a river running off its edge
// carried on to the land's, its hills and shelves over the land's relief. The rest of the land, its regions, its
// places, its fog and where the town puts things are made as for any land. Its `Landmark`s (old walls, a statue, a
// well...) are drawn on the map (iso/isoView.ts) while their cells lie as the valley left them; the rules never see
// them. A town keeps its valley's id (`GameState.valley`); older towns have none.

import { START_VALLEYS } from '../data/startValleys';
import { BIOMES, type Biome } from '../data/biomes';
import { SCENARIOS } from '../data/founding';
import { hashSeed, Rng } from '../rng';
import { fieldList, type HandMap, type MapKindSpec } from './handMaps';
import type { Ground } from './land';

/** How often a town founded where a valley fits starts in one (the rest on the land the seed makes). */
export const HAND_VALLEY_SHARE = 0.6;

/** The grounds, written as the land writes them (sim/land.ts `CODE`); '?' keeps the land's own. */
export const VALLEY_GROUNDS: readonly { ch: string; id: Ground }[] = [
  { ch: '.', id: 'grass' },
  { ch: 'f', id: 'forest' },
  { ch: 'r', id: 'rock' },
  { ch: 'm', id: 'marsh' },
  { ch: 'h', id: 'hill' },
  { ch: 'w', id: 'water' },
  { ch: 'F', id: 'fertile' },
  { ch: 's', id: 'sand' },
  { ch: 'M', id: 'mountain' },
  { ch: 'S', id: 'shallows' },
];
export const VALLEY_KEEP = '?';
/** The relief (sim/relief.ts): level, downs, rocky hills, high ground, a ramp up, a range; '.' level where the valley
 *  lays ground, the land's own where it doesn't. */
export const VALLEY_RELIEF: readonly { ch: string; id: string }[] = [
  { ch: '0', id: 'level' },
  { ch: '1', id: 'downs' },
  { ch: '2', id: 'rocky' },
  { ch: '3', id: 'high' },
  { ch: '4', id: 'ramp' },
  { ch: '5', id: 'range' },
];
/** What's drawn on a valley's cells: old walls and ruins, standing stones, a statue, a well, boulders... */
export const LANDMARK_KINDS = ['ruin', 'wall', 'pillar', 'statue', 'well', 'boulder', 'bones', 'skeleton', 'stump', 'reeds', 'flowers', 'cart', 'signpost'] as const;
export type LandmarkKind = (typeof LANDMARK_KINDS)[number];

export const VALLEY_SPEC: MapKindSpec = {
  project: 'maps/start-valleys.ldtk',
  out: 'src/shared/data/startValleys.ts',
  exportName: 'START_VALLEYS',
  what: 'The starting valleys drawn by hand (sim/startValleys.ts)',
  grids: [
    { layer: 'Ground', values: VALLEY_GROUNDS, empty: VALLEY_KEEP },
    { layer: 'Relief', values: VALLEY_RELIEF, empty: '.' },
  ],
  entities: [
    { layer: 'Things', entity: 'Camp', fields: [] },
    { layer: 'Things', entity: 'Landmark', fields: [{ id: 'kind', of: LANDMARK_KINDS }] },
  ],
  levelFields: [
    { id: 'name', type: 'string' },
    { id: 'about', type: 'string', optional: true },
    { id: 'biomes', type: 'strings', of: BIOMES },
    { id: 'scenarios', type: 'strings', of: SCENARIOS.map((s) => s.id), optional: true },
  ],
};

/** The valleys a town on this land, founded with this scenario, may start in. */
export const valleysFor = (biome: Biome, scenario: string): HandMap[] =>
  START_VALLEYS.filter((m) => fieldList(m, 'biomes').includes(biome) && (!fieldList(m, 'scenarios').length || fieldList(m, 'scenarios').includes(scenario)));

export const valleyById = (id: string | undefined): HandMap | undefined => (id ? START_VALLEYS.find((m) => m.id === id) : undefined);

/** The valley a town founded with this seed starts in, or null for the land the seed makes (`HAND_VALLEY_SHARE` of the
 *  towns a valley fits; the 'valley' side stream's, so nothing else the seed makes is changed by the pick). */
export function pickValley(seed: string, biome: Biome, scenario: string): HandMap | null {
  const fit = valleysFor(biome, scenario);
  if (!fit.length) return null;
  const rng = new Rng(hashSeed(`${seed}:valley`));
  if (rng.next() >= HAND_VALLEY_SHARE) return null;
  return fit[rng.int(0, fit.length - 1)];
}

/** Where a valley's camp is drawn. */
export function valleyCamp(m: HandMap): { u: number; v: number } {
  const t = m.things.find((x) => x[2] === 'Camp');
  return t ? { u: t[0], v: t[1] } : { u: Math.floor(m.w / 2), v: Math.floor(m.h / 2) };
}

/** The land's cell under a valley's top-left cell, its camp on the land's camp. */
export function valleyOrigin(m: HandMap, camp: { x: number; y: number }): { x: number; y: number } {
  const c = valleyCamp(m);
  return { x: camp.x - c.u, y: camp.y - c.v };
}

const GROUND_OF: Readonly<Record<string, Ground>> = Object.fromEntries(VALLEY_GROUNDS.map((g) => [g.ch, g.id]));

/** Each land cell a valley lays ground on, and the ground. */
export function valleyCells(m: HandMap, w: number, h: number, camp: { x: number; y: number }): [number, Ground][] {
  const o = valleyOrigin(m, camp);
  const out: [number, Ground][] = [];
  for (let v = 0; v < m.h; v++)
    for (let u = 0; u < m.w; u++) {
      const g = GROUND_OF[m.grids.Ground[v][u]];
      const x = o.x + u;
      const y = o.y + v;
      if (g && x >= 0 && y >= 0 && x < w && y < h) out.push([y * w + x, g]);
    }
  return out;
}

/** How near a valley's corner water at its edge may lie and still run on. */
export const RUN_CORNER = 10;

/** Lay a valley's ground over the land's (`makeLand`, before the pools are filled), and carry on to the land's edge any
 *  water that runs off the valley's own edge (a river valley's river, a cove's sea), wandering a little and banked with
 *  rich soil, on the valley's own side stream. */
export function layValley(grid: Ground[], w: number, h: number, camp: { x: number; y: number }, m: HandMap, seed: string): void {
  for (const [i, g] of valleyCells(m, w, h, camp)) grid[i] = g;
  const o = valleyOrigin(m, camp);
  const rng = new Rng(hashSeed(`${seed}:valley:runs`));
  const wetCh = (ch: string) => ch === 'w' || ch === 'S';
  const runs: [number, number, number, number][] = [];
  // (not within RUN_CORNER of a corner: a cove's sea along its foot runs on south, not off its sides as well)
  for (let v = 0; v < m.h; v++)
    for (let u = 0; u < m.w; u++) {
      if (!wetCh(m.grids.Ground[v][u])) continue;
      if (Math.min(u, m.w - 1 - u) < RUN_CORNER && Math.min(v, m.h - 1 - v) < RUN_CORNER) continue;
      if (u === 0) runs.push([u, v, -1, 0]);
      if (u === m.w - 1) runs.push([u, v, 1, 0]);
      if (v === 0) runs.push([u, v, 0, -1]);
      if (v === m.h - 1) runs.push([u, v, 0, 1]);
    }
  // (each run wanders by the same steps as its neighbours, so a river's width runs on together)
  const drift = new Map<string, number[]>();
  for (const [u, v, du, dv] of runs) {
    const side = `${du},${dv}`;
    let steps = drift.get(side);
    if (!steps) {
      steps = [];
      let off = 0;
      for (let k = 0; k < Math.max(w, h); k++) {
        if (k > 2 && rng.chance(0.18)) off += rng.chance(0.5) ? 1 : -1;
        steps.push(off);
      }
      drift.set(side, steps);
    }
    for (let k = 1; ; k++) {
      const x: number = o.x + u + du * k + (dv ? steps[k] : 0);
      const y: number = o.y + v + dv * k + (du ? steps[k] : 0);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const i = y * w + x;
      if (grid[i] === 'water' && k > 3) break;
      grid[i] = 'water';
      // (its banks, where the land is open)
      for (const [bx, by] of [[x + dv, y + du], [x - dv, y - du]])
        if (bx >= 0 && by >= 0 && bx < w && by < h && (grid[by * w + bx] === 'grass' || grid[by * w + bx] === 'sand')) grid[by * w + bx] = 'fertile';
    }
  }
}

/** Lay a valley's hills and shelves over the land's relief (`makeLand`, after `layRelief`): level where it lays ground
 *  and says nothing, the land's own where it lays none. */
export function layValleyRelief(relief: string, w: number, h: number, camp: { x: number; y: number }, m: HandMap): string {
  const o = valleyOrigin(m, camp);
  const out = relief.split('');
  for (let v = 0; v < m.h; v++)
    for (let u = 0; u < m.w; u++) {
      const x = o.x + u;
      const y = o.y + v;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const r = m.grids.Relief[v][u];
      if (r !== '.') out[y * w + x] = r;
      else if (GROUND_OF[m.grids.Ground[v][u]]) out[y * w + x] = '0';
    }
  return out.join('');
}

/** Each landmark on the land: its cell, and what it is. */
export function valleyLandmarks(m: HandMap, w: number, camp: { x: number; y: number }): [number, LandmarkKind][] {
  const o = valleyOrigin(m, camp);
  return m.things.filter((t) => t[2] === 'Landmark').map((t) => [(o.y + t[1]) * w + o.x + t[0], t[3] as LandmarkKind]);
}
