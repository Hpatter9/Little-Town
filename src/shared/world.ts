// Seeded terrain generation. Pure data: the renderer decides how each terrain kind looks.

import { BACK_PAD_TILES, CAMP_CLEAR_RADIUS, WORLD_TILES } from './constants';
import { Rng, hashSeed } from './rng';
import { BIOME_DEFS, type Biome } from './data/biomes';

/** Midground terrain. Anything other than 'clear' must be cleared before building (yields materials). */
export type MidTerrain = 'clear' | 'forest' | 'rock' | 'marsh' | 'hill';

/** Background terrain, where farms, fields and mines will go. */
export type BackTerrain = 'meadow' | 'forest' | 'hills' | 'marsh' | 'river' | 'fertile';

export interface World {
  seed: string;
  seedHash: number;
  tiles: number;
  /** Tile column the camp is centred on. */
  camp: number;
  /** Midground terrain per tile column, 0..tiles-1. */
  mid: MidTerrain[];
  /** Background terrain per column from -BACK_PAD_TILES to tiles+BACK_PAD_TILES-1 (index = column + BACK_PAD_TILES). */
  back: BackTerrain[];
  /** Tile columns where a river crosses the background. */
  rivers: number[];
}

export function generateWorld(seed: string, biome: Biome = 'forest'): World {
  // how common each kind of land is depends on the biome
  const MID_WEIGHTS: Record<Exclude<MidTerrain, 'clear'>, number> = BIOME_DEFS[biome].mid;
  const BACK_WEIGHTS: Record<Exclude<BackTerrain, 'river'>, number> = BIOME_DEFS[biome].back;
  const seedHash = hashSeed(seed);
  const tiles = WORLD_TILES;
  const camp = Math.floor(tiles / 2);

  // Rivers: one or two crossings, never through the starting clearing.
  const rivRng = Rng.from(seedHash, 1);
  const rivers: number[] = [];
  const riverCount = rivRng.chance(0.4) ? 2 : 1;
  for (let tries = 0; rivers.length < riverCount && tries < 50; tries++) {
    // Bias the first river toward the camp so early farms have a reason to sit beside it.
    const col = rivers.length === 0 ? camp + rivRng.pick([-1, 1]) * rivRng.int(CAMP_CLEAR_RADIUS + 2, 30) : rivRng.int(10, tiles - 12);
    if (Math.abs(col - camp) <= CAMP_CLEAR_RADIUS + 1) continue;
    if (rivers.some((r) => Math.abs(r - col) < 20)) continue;
    rivers.push(col);
  }
  const nearRiver = (col: number, dist: number) => rivers.some((r) => Math.abs(r - col) <= dist);

  // Midground: cleared camp in the middle, wild runs of terrain outward to each edge.
  const midRng = Rng.from(seedHash, 2);
  const mid: MidTerrain[] = new Array(tiles);
  for (let c = camp - CAMP_CLEAR_RADIUS; c < camp + CAMP_CLEAR_RADIUS; c++) mid[c] = 'clear';
  const fillOutward = (start: number, step: 1 | -1) => {
    let c = start;
    let prev: MidTerrain = 'clear';
    while (c >= 0 && c < tiles) {
      let kind = midRng.weighted(MID_WEIGHTS);
      if (kind === prev && midRng.chance(0.6)) kind = midRng.weighted(MID_WEIGHTS);
      const len = kind === 'hill' ? midRng.int(4, 8) : midRng.int(3, 10);
      for (let i = 0; i < len && c >= 0 && c < tiles; i++, c += step) {
        mid[c] = nearRiver(c, 1) ? 'marsh' : kind;
      }
      prev = kind;
    }
  };
  fillOutward(camp + CAMP_CLEAR_RADIUS, 1);
  fillOutward(camp - CAMP_CLEAR_RADIUS - 1, -1);

  // Background: runs of terrain across the padded width, rivers cut through, fertile soil beside rivers.
  const backRng = Rng.from(seedHash, 3);
  const backLen = tiles + BACK_PAD_TILES * 2;
  const back: BackTerrain[] = new Array(backLen);
  for (let i = 0; i < backLen; ) {
    const kind = backRng.weighted(BACK_WEIGHTS);
    const len = backRng.int(4, 14);
    for (let j = 0; j < len && i < backLen; j++, i++) back[i] = kind;
  }
  for (let i = 0; i < backLen; i++) {
    const col = i - BACK_PAD_TILES;
    if (rivers.includes(col) || rivers.includes(col - 1)) back[i] = 'river';
    else if (nearRiver(col, 3) && back[i] !== 'hills') back[i] = backRng.chance(0.7) ? 'fertile' : 'marsh';
  }
  // Keep the land right behind the camp open so the first farms have somewhere to go.
  for (let col = camp - 4; col < camp + 4; col++) {
    const i = col + BACK_PAD_TILES;
    if (back[i] === 'forest' || back[i] === 'hills') back[i] = 'meadow';
  }

  return { seed, seedHash, tiles, camp, mid, back, rivers };
}
