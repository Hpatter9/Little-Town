// Hauling you can see (the owner's ask: goods carried along the streets, not appearing in the stores): someone
// walking with a heavy load pushes a wheelbarrow heaped with it. Pure, so the rules are tested.

import type { PersonView } from '../../shared/sim/snapshot';

/** A load at least this heavy (units) goes in a barrow. */
export const HAUL_LEAST = 4;

/** The heap's colours by what's in it (a material's id, by its word), with a lighter top. */
const HEAPS: [RegExp, number, number][] = [
  [/wood|log|lumber|plank|stick|branch/, 0x8a5a30, 0xb88050],
  [/stone|rock|brick|slab|concrete/, 0x8a8a90, 0xb8b8c0],
  [/ore|coal|sulphur|iron|copper|tin|silver/, 0x4a4248, 0x8a7a70],
  [/gold/, 0xc89a28, 0xf0d060],
  [/gem|pearl|crystal/, 0x5ab0c8, 0xb0f0ff],
  [/berr|fruit|apple/, 0xa83048, 0xe06070],
  [/wheat|grain|flax|fiber|straw|hay/, 0xc8a048, 0xf0d888],
  [/veget|herb|kelp|cabbage/, 0x4a8a3a, 0x8ac860],
  [/meat|fish|hide|pelt|leather/, 0x9a5048, 0xd08870],
  [/clay|sand|mud/, 0xa87050, 0xd0a080],
  [/wool|cloth/, 0xd8d0c0, 0xffffff],
];

/** The material they carry most of, and how much they carry in all. */
export function mainLoad(carrying: PersonView['carrying']): [string | null, number] {
  let best: string | null = null;
  let most = 0;
  let total = 0;
  for (const [m, n] of Object.entries(carrying)) {
    const k = n ?? 0;
    total += k;
    if (k > most) [best, most] = [m, k];
  }
  return [best, total];
}

/** Whether they push a barrow now: walking with a heavy load, on their own feet, out of any fight. */
export function hauls(v: PersonView, moving: boolean): boolean {
  if (!moving || v.indoors || v.mounted !== null || v.swimming || v.activity === 'fight' || v.downed !== null) return false;
  if (v.growsUpIn !== null) return false;
  return mainLoad(v.carrying)[1] >= HAUL_LEAST;
}

/** The heap's colour and its top's, for a material. */
export function heapColour(material: string | null): [number, number] {
  if (material) for (const [re, c, top] of HEAPS) if (re.test(material)) return [c, top];
  return [0x8a6a48, 0xb89a70];
}
