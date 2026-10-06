// The wild grows back (the owner's ask: trees and shrubs regrow). A wood, marsh or scrubby hill gathered bare
// (`clearCell` in people.ts) is remembered (`LandMap.regrow`: the cell, what it was, and when it comes back), and once
// its time is up (`REGROW_DAYS` by kind, spread by the cell) it grows back as it was, its pool rolled afresh: unless
// something stands on it, a road runs over it, a building stands beside it (the yards are kept), or people still
// walk it (a footpath showing): then it waits another day. Rock and the mountain don't grow back.

import { Rng, hashSeed } from '../rng';
import { TERRAIN } from '../data/terrain';
import type { Material } from '../data/materials';
import { builtOn, footprint } from './buildings';
import { cellAt, groundAt, idx, inMap, isRoad, setGround, wearAt, WEAR_SHOW, type Ground } from './land';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import type { GameState } from './state';

/** Days a cleared cell takes to grow back, by what it was. */
export const REGROW_DAYS: Partial<Record<Ground, number>> = { forest: 5, marsh: 2, hill: 3 };
/** How much a cell's time is spread either way (a share of it), so a clearing doesn't spring back all at once. */
const SPREAD = 0.4;

/** A wild cell has been gathered bare: remember what it was, and when it comes back. */
export function noteCleared(s: GameState, i: number, was: Ground): void {
  const days = REGROW_DAYS[was];
  if (!days) return;
  const k = ((hashSeed(`${s.seed}:${i}`) % 1000) / 1000 - 0.5) * 2 * SPREAD;
  (s.land.regrow ??= {})[i] = [was, s.tick + Math.round(days * (1 + k) * TICKS_PER_DAY)];
}

/** Hourly: whatever's due grows back, where nothing keeps it clear. */
export function regrowHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !s.land.regrow) return;
  const m = s.land;
  let yards: Set<number> | null = null;
  for (const [key, [was, at]] of Object.entries(m.regrow!)) {
    if (s.tick < at) continue;
    const i = Number(key);
    const { x, y } = cellAt(m, i);
    const g = groundAt(m, x, y);
    // (built on, ploughed, dug into: it won't come back)
    if (g !== 'grass' && g !== 'sand' && g !== 'fertile') {
      delete m.regrow![i];
      continue;
    }
    if (!yards) {
      yards = new Set();
      for (const b of s.buildings) {
        const f = footprint(b);
        for (let yy = f.y - 1; yy <= f.y + f.h; yy++) for (let xx = f.x - 1; xx <= f.x + f.w; xx++) if (inMap(m, xx, yy)) yards.add(idx(m, xx, yy));
      }
    }
    if (builtOn(s, x, y) || isRoad(m, x, y) || yards.has(i) || wearAt(m, i) >= WEAR_SHOW) {
      m.regrow![i] = [was, s.tick + TICKS_PER_DAY]; // (kept clear: it tries again tomorrow)
      continue;
    }
    setGround(m, x, y, was);
    const rng = Rng.from(hashSeed(s.seed), i, Math.floor(s.tick / TICKS_PER_DAY));
    const pool: Partial<Record<Material, number>> = {};
    for (const [mat, [lo, hi]] of Object.entries(TERRAIN[was as keyof typeof TERRAIN].pool) as [Material, [number, number]][]) {
      const n = rng.int(lo, hi);
      if (n > 0) pool[mat] = n;
    }
    m.pools[i] = pool;
    delete m.regrow![i];
  }
  if (!Object.keys(m.regrow!).length) delete m.regrow;
}
