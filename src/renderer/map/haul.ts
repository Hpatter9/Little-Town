// Hauling you can see (the owner's ask: goods carried along the streets, not appearing in the stores): someone
// walking with a heavy load pushes a wheelbarrow heaped with it. Pure, so the rules are tested.

import type { PersonView } from '../../shared/sim/snapshot';
import type { Material } from '../../shared/data/materials';
import { FOLK_DIRS, type FolkDir } from '../iso/folkRules';
import { pileOf } from './workSeen';
import made from '../art/iso/made.json';

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

/* ------------------------------------------------------------ the barrow in the isometric view */

/** The barrow's loads drawn by PixelLab (docs/notes/pixellab-plan.md): a heap of each kind the stockpile knows
 *  (map/workSeen.ts `pileOf`; barrels ride as crates). */
export type BarrowLoad = 'logs' | 'stone' | 'sacks' | 'crates';
/** Its two views: going away down-right (`se`) or up-right (`ne`) on screen; the left-going ones are these mirrored. */
export type BarrowView = 'se' | 'ne';
/** The views and loads made so far (`${view}_${load}`, art/iso/made.json, set by tools/pixellab/assemble_nov.py):
 *  until a barrow's picture is in, the old side-on barrow and its painted heap stand in. */
export const BARROWS_MADE: ReadonlySet<string> = new Set(made.barrow as string[]);
/** How far ahead of the one pushing it the barrow stands (map px), and its size (the kit's props': the settlers' kit
 *  at the view's size, baked to 0.6 as tools/grid-recut.py bakes the props). */
export const ISO_BARROW_AHEAD = 11;
export const ISO_BARROW_SCALE = 1.326 * 0.5 * 0.6;

/** The load a material rides as. */
export function barrowLoad(material: string | null): BarrowLoad {
  if (!material) return 'crates';
  const k = pileOf(material as Material);
  return k === 'barrels' ? 'crates' : k;
}

/** Where the barrow goes for someone facing `dir` on screen: its view, mirrored or not, and the way ahead of them on
 *  the map (a unit step: the map's east is the screen's south-east, iso/folkRules.ts `facingFromVector`). */
export function barrowPlace(dir: FolkDir): { view: BarrowView; flip: boolean; dx: number; dy: number } {
  const i = FOLK_DIRS.indexOf(dir);
  const a = ((1 - i) * 45 * Math.PI) / 180;
  const left = dir === 'south-west' || dir === 'west' || dir === 'north-west';
  const up = dir === 'north' || dir === 'north-east' || dir === 'north-west';
  return { view: up ? 'ne' : 'se', flip: left, dx: Math.cos(a), dy: Math.sin(a) };
}

/** A barrow picture's address (beside the settlers' kit), or null while that one isn't made. */
export const isoBarrowUrl = (view: BarrowView, load: BarrowLoad): string | null => (BARROWS_MADE.has(`${view}_${load}`) ? `iso/kits/settlers/barrow_${view}_${load}.png` : null);
