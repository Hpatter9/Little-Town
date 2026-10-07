// The wide land's regions (the owner's ask: a much larger map). Beyond the home vale round the camp the land is cut
// into named countries, each with a character of its own that makeLand (land.ts) shapes the ground by: the Old Wood
// (deep forest), a fen (marsh with standing water), barrens (rock and scree), meadows (open grass and rich soil), a
// lake with marshy banks, highlands (hill and crag) and heath (scrub on the hills). Their borders wander with noise.
// A region's name is seeded, so every land has its own: "Blackmere Fen", "the Grey Barrens", "Larksmeadow". No DOM,
// no Pixi: the sim, the places and the tests read it as the renderer does.

import type { Biome } from '../data/biomes';
import type { Ground } from './land';

export type RegionKind = 'vale' | 'oldwood' | 'fen' | 'barrens' | 'meadows' | 'lake' | 'highlands' | 'heath';

export interface LandRegion {
  id: number;
  kind: RegionKind;
  name: string;
  /** Its heart, in cells. */
  x: number;
  y: number;
}

export interface RegionDef {
  /** How much of its ground is wild (the vale's 0.5 is the land as it was). */
  wildShare: number;
  /** Multipliers on the biome's own mix of wild kinds. */
  mix: Partial<Record<Ground, number>>;
  /** Open ground turned to rich soil, as a share. */
  fertile?: number;
  /** A lake at its heart, this many cells across (its banks marsh). */
  lake?: number;
  /** What's found there more than elsewhere (sim/places.ts): multipliers on the place kinds' weights. */
  places: Partial<Record<string, number>>;
  /** Name pools: a leading word and a kind word, with the land's own spellings. */
  names: { first: string[]; last: string[]; desert?: string[]; tundra?: string[]; alt?: Partial<Record<string, string[]>> };
}

export const REGION_DEFS: Record<RegionKind, RegionDef> = {
  vale: { wildShare: 0.5, mix: {}, places: {}, names: { first: ['Home'], last: ['Vale'] } },
  oldwood: {
    wildShare: 0.86,
    mix: { forest: 6, rock: 0.3, marsh: 0.6, hill: 0.4 },
    places: { lair: 3, bones: 1.5, cart: 0.5 },
    names: { first: ['Old', 'Deep', 'Dark', 'Tangle', 'Hart', 'Elder', 'Thorn', 'Owl'], last: ['Wood', 'Forest', 'Wold'], desert: ['Scrub', 'Thornland'], tundra: ['Pines', 'Taiga'], alt: { ashlands: ['Char', 'Cinderwood'], jungle: ['Canopy', 'Tangle'], taiga: ['Pines', 'Firs'], steppe: ['Copse', 'Thornland'] } },
  },
  fen: {
    wildShare: 0.7,
    mix: { forest: 0.5, rock: 0.2, marsh: 6, hill: 0.2 },
    places: { bones: 2.5, ruins: 1.5, vein: 0.3 },
    names: { first: ['Black', 'Grey', 'Reed', 'Mist', 'Sallow', 'Crane', 'Drowned'], last: ['Fen', 'Marsh', 'Mire'], desert: ['Flats', 'Salt Pan'], tundra: ['Bog', 'Frozen Fen'] },
  },
  barrens: {
    wildShare: 0.72,
    mix: { forest: 0.2, rock: 6, marsh: 0.1, hill: 1.5 },
    places: { vein: 3, cave: 1.5, cart: 0.4 },
    names: { first: ['Grey', 'Broken', 'Red', 'Bone', 'Stony', 'Bleak', 'Iron'], last: ['Barrens', 'Scree', 'Waste'], desert: ['Wadi', 'Flint Waste'], tundra: ['Fell', 'Rime Barrens'], alt: { ashlands: ['Cinders', 'Slag', 'Lava Field'], swamp: ['Shoals', 'Mudflats'] } },
  },
  meadows: {
    wildShare: 0.22,
    mix: { forest: 1, rock: 0.3, marsh: 0.5, hill: 1 },
    fertile: 0.22,
    places: { cart: 2.5, ruins: 2, lair: 0.3 },
    names: { first: ['Lark', 'Long', 'Sweet', 'Green', 'Fair', 'Bright', 'Clover'], last: ['Meadows', 'Lea', 'Downs'], desert: ['Steppe', 'Grasslands'], tundra: ['Tussocks', 'Moss Flats'], alt: { ashlands: ['Ashfield', 'Flats'], steppe: ['Grasslands', 'Plains'], jungle: ['Clearing', 'Glade'] } },
  },
  lake: {
    wildShare: 0.45,
    mix: { forest: 2, rock: 0.5, marsh: 2.5, hill: 0.5 },
    lake: 15,
    places: { cart: 1.5, ruins: 1.5, bones: 1.2 },
    names: { first: ['Mirror', 'Still', 'Silver', 'Loon', 'Hidden', 'Cold', 'Heron'], last: ['Lake', 'Mere', 'Tarn'], desert: ['Oasis', 'Salt Lake'], tundra: ['Ice Mere', 'Tarn'] },
  },
  highlands: {
    wildShare: 0.7,
    mix: { forest: 1, rock: 3, marsh: 0.1, hill: 5 },
    places: { cave: 3, vein: 1.5, lair: 1.2 },
    names: { first: ['High', 'Windy', 'Eagle', 'Grim', 'Far', 'Thunder', 'Wolf'], last: ['Highlands', 'Crags', 'Tors'], desert: ['Mesas', 'Buttes'], tundra: ['Fells', 'Heights'] },
  },
  heath: {
    wildShare: 0.55,
    mix: { forest: 1.2, rock: 1, marsh: 0.4, hill: 4 },
    places: { lair: 1.5, cart: 1.2, ruins: 1.2 },
    names: { first: ['Gorse', 'Heather', 'Bramble', 'Fox', 'Broom', 'Wild', 'Ash'], last: ['Heath', 'Moor', 'Scrubland'], desert: ['Badlands', 'Scrub'], tundra: ['Moor', 'Tundra'] },
  },
};

/** The home vale's reach from the camp each way (cells): the old land's whole box, so a seed's town starts on the
 *  land it always had, pools and all; its rim wanders outward a little (`VALE_RIM`). */
export const VALE_R = 48;
const VALE_RIM = 6;
/** How far the region borders wander (cells). */
const BORDER_WARP = 7;
const WARP_SCALE = 16;

/** A small stable hash to 0..1 (its own, so this file stands alone). */
function h2(seed: number, x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 0xffff;
}
/** Smooth value noise, 0..1, at a scale (cells). */
export function regionNoise(seed: number, x: number, y: number, scale: number): number {
  const s = (t: number) => t * t * (3 - 2 * t);
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = s(gx - x0);
  const fy = s(gy - y0);
  const a = h2(seed, x0, y0) + (h2(seed, x0 + 1, y0) - h2(seed, x0, y0)) * fx;
  const b = h2(seed, x0, y0 + 1) + (h2(seed, x0 + 1, y0 + 1) - h2(seed, x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** Lays the regions of a land: the vale at the camp and a ring of others round it, each kind once where it can be,
 *  named from its pools; the kinds shuffled by the seed, the hearts jittered. */
export function layRegions(seedHash: number, w: number, h: number, camp: { x: number; y: number }, biome: Biome): LandRegion[] {
  // (every kind once, and a second meadow or wood: eight countries round the vale)
  const kinds: RegionKind[] = ['oldwood', 'fen', 'barrens', 'meadows', 'lake', 'highlands', 'heath', h2(seedHash ^ 0x9d, 0, 0) < 0.5 ? 'meadows' : 'oldwood'];
  // (a shuffle by the seed)
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(h2(seedHash ^ 0x9e, i, 0) * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const out: LandRegion[] = [{ id: 1, kind: 'vale', name: 'the Home Vale', x: camp.x, y: camp.y }];
  const used = new Set<string>();
  const n = Math.min(kinds.length, 8);
  // (the hearts stand clear of the vale's box, on a ring well outside it)
  const ring = Math.min(w, h) * 0.4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + h2(seedHash ^ 0x9f, i, 1) * 0.5;
    const r = ring * (0.95 + h2(seedHash ^ 0xa0, i, 2) * 0.25);
    const x = Math.round(Math.min(w - 4, Math.max(3, camp.x + Math.cos(a) * r)));
    const y = Math.round(Math.min(h - 4, Math.max(3, camp.y + Math.sin(a) * r)));
    const kind = kinds[i];
    out.push({ id: i + 2, kind, name: nameFor(seedHash, i, kind, biome, used), x, y });
  }
  return out;
}

function nameFor(seedHash: number, i: number, kind: RegionKind, biome: Biome, used: Set<string>): string {
  const d = REGION_DEFS[kind].names;
  const lasts = d.alt?.[biome] ?? ((biome === 'desert' && d.desert) || (biome === 'tundra' && d.tundra) || d.last);
  for (let t = 0; t < 12; t++) {
    const first = d.first[Math.floor(h2(seedHash ^ 0xa1, i, t) * d.first.length)];
    const last = lasts[Math.floor(h2(seedHash ^ 0xa2, i, t) * lasts.length)];
    // (never "the High Highlands")
    if (last.toLowerCase().startsWith(first.toLowerCase())) continue;
    // ("Larksmeadow" when the words run together; else "the Grey Barrens")
    const joined = h2(seedHash ^ 0xa3, i, t) < 0.3 && last.length <= 6 && !last.includes(' ') ? `${first}${last.toLowerCase()}` : `the ${first} ${last}`;
    if (!used.has(joined)) {
      used.add(joined);
      return joined;
    }
  }
  return `the ${d.first[0]} ${lasts[0]}`;
}

/** Which region a cell lies in: the vale within VALE_R of the camp (its edge wandering), else the nearest heart,
 *  the borders warped by noise so they aren't straight. Null with no regions (an older land). */
export function regionAt(regions: LandRegion[] | undefined, seedHash: number, x: number, y: number): LandRegion | null {
  if (!regions?.length) return null;
  const vale = regions[0];
  // (the old box ran from VALE_R below the camp to VALE_R - 1 above it)
  if (x - vale.x >= -VALE_R && x - vale.x < VALE_R && y - vale.y >= -VALE_R && y - vale.y < VALE_R) return vale;
  const wx = x + (regionNoise(seedHash ^ 0xb1, x, y, WARP_SCALE) - 0.5) * 2 * BORDER_WARP;
  const wy = y + (regionNoise(seedHash ^ 0xb2, x, y, WARP_SCALE) - 0.5) * 2 * BORDER_WARP;
  if (wx - vale.x >= -VALE_R - VALE_RIM && wx - vale.x < VALE_R + VALE_RIM && wy - vale.y >= -VALE_R - VALE_RIM && wy - vale.y < VALE_R + VALE_RIM) return vale;
  let best = vale;
  let bd = Infinity;
  for (let i = 1; i < regions.length; i++) {
    const r = regions[i];
    const d = Math.hypot(wx - r.x, wy - r.y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

/** "in the Grey Barrens" / "in Larksmeadow" (the vale is home: ""). */
export function inRegion(r: LandRegion | null): string {
  if (!r || r.kind === 'vale') return '';
  return ` in ${r.name}`;
}
/** The name with its first letter up, for a caption. */
export function regionTitle(r: LandRegion): string {
  return r.name.replace(/^the /, 'The ');
}
