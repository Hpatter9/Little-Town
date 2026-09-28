// What working a wild midground tile yields. Gathering a tile until its pool is empty clears it.
// All numbers are starting points for tuning.

import type { MidTerrain } from '../world';
import type { Material } from './materials';

export type WorkAnim = 'chop' | 'mine' | 'forage';

export interface TerrainDef {
  name: string;
  /** Verb shown while working it. */
  verb: string;
  anim: WorkAnim;
  /** Base seconds to gather one unit (before era multiplier and worker speed). */
  secondsPerUnit: number;
  /** Starting pool per tile: [min, max] units of each material. */
  pool: Partial<Record<Material, [number, number]>>;
}

export const TERRAIN: Record<Exclude<MidTerrain, 'clear'>, TerrainDef> = {
  forest: { name: 'Forest', verb: 'Chopping', anim: 'chop', secondsPerUnit: 6, pool: { wood: [8, 12], fiber: [1, 3], berries: [0, 3] } },
  rock: { name: 'Rocks', verb: 'Breaking rock', anim: 'mine', secondsPerUnit: 8, pool: { stone: [6, 10], flint: [2, 4] } },
  marsh: { name: 'Marsh', verb: 'Foraging', anim: 'forage', secondsPerUnit: 5, pool: { fiber: [3, 6], clay: [2, 4], herbs: [1, 3] } },
  hill: { name: 'Hill', verb: 'Digging', anim: 'mine', secondsPerUnit: 7, pool: { stone: [2, 4], fiber: [2, 4], flint: [0, 2], herbs: [0, 2] } },
};
