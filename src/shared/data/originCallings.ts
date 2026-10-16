// Each people's own base callings (the owner's ask: "3 extra base classes per origin with the same number of
// evolutions as the regular classes"). Three a people, thirty-nine in all, each a whole tree like a shared base
// calling's (the shape in data/callings/kit.ts; each people's in data/callings/<people>.ts). Only that people's folk
// (and strangers of that people who join) may start on one: sim/classes.ts `assignClass` weighs them beside the eight
// shared bases, by the same fit, leaned a little their way (`ORIGIN_CALLING_LEAN`) so a town looks like its people.
// data/paths.ts builds them into the tree (`CALLING_PATHS`, ids `oc_<people>_<id>`); their numbers are the shared
// callings' at each stage, with the origin roads' edge (`ORIGIN_EDGE`) only on the ascended form (data/levels.ts).

import type { OriginId } from './origins';
import type { CallingNode, CallingTree } from './callings/kit';
import { SETTLERS_CALLINGS } from './callings/settlers';
import { LICH_CALLINGS } from './callings/lich';
import { DRUID_CALLINGS } from './callings/druid';
import { VAMPIRE_CALLINGS } from './callings/vampire';
import { WEREWOLF_CALLINGS } from './callings/werewolf';
import { ROBOT_CALLINGS } from './callings/robot';
import { DWARVES_CALLINGS } from './callings/dwarves';
import { MERFOLK_CALLINGS } from './callings/merfolk';
import { NOMADS_CALLINGS } from './callings/nomads';
import { FAE_CALLINGS } from './callings/fae';
import { ALCHEMISTS_CALLINGS } from './callings/alchemists';
import { KNIGHTS_CALLINGS } from './callings/knights';
import { ORCS_CALLINGS } from './callings/orcs';

export type { CallingForm, CallingLeaf, CallingNode, CallingTree } from './callings/kit';

/** Every people's own base callings, in the order of data/origins.ts ORIGINS. */
export const ORIGIN_CALLINGS: readonly CallingTree[] = [
  ...SETTLERS_CALLINGS, ...LICH_CALLINGS, ...DRUID_CALLINGS, ...VAMPIRE_CALLINGS, ...WEREWOLF_CALLINGS, ...ROBOT_CALLINGS,
  ...DWARVES_CALLINGS, ...MERFOLK_CALLINGS, ...NOMADS_CALLINGS, ...FAE_CALLINGS, ...ALCHEMISTS_CALLINGS,
  ...KNIGHTS_CALLINGS, ...ORCS_CALLINGS,
];
/** How many base callings each people has of its own. */
export const CALLINGS_PER_PEOPLE = 3;
/** How much more a people's own base callings draw its folk than a shared one of the same fit (a mild lean: with
 *  three of their own beside the eight shared, about two in five of a town's folk start on one). */
export const ORIGIN_CALLING_LEAN = 1.6;
/** A node's full id: `oc_<people>_<id>` (kept apart from the shared tree's and the origin roads' ids). */
export const callingId = (origin: OriginId, id: string) => `oc_${origin}_${id}`;
/** A tree's fifteen written nodes (the base and its roads to stage 3), each with its full id. */
export function callingNodes(t: CallingTree): [string, CallingNode][] {
  const out: [string, CallingNode][] = [[callingId(t.origin, t.base.id), t.base]];
  for (const [r1, roads2] of t.roads) {
    out.push([callingId(t.origin, r1.id), r1]);
    for (const [r2, roads3] of roads2) {
      out.push([callingId(t.origin, r2.id), r2]);
      for (const r3 of roads3) out.push([callingId(t.origin, r3.id), r3]);
    }
  }
  return out;
}
