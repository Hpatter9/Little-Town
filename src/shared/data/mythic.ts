// The mythic callings (the owner's ask: "mythic rare classes. Only a few that show up very very rarely. Like a
// summoner"). Five whole trees above every other calling (the shape in data/callings/kit.ts `MythicTree`; the content in
// data/callings/mythic.ts), open to any people but given to very few: when someone takes their first calling (in a town
// run by its autopilot), `MYTHIC_ODDS` that it is one of these (sim/classes.ts `mythicRoll`), higher for the child of
// two ascended parents (`MYTHIC_HEIR_ODDS`) and for the first to take a calling after an ascension stirs the old powers
// (`MYTHIC_OMEN_ODDS`). The Summoner is one of them now: the shared Summoner road (and all after it) grows from the
// first mythic base, and the Wanderer has a new road in its place. Their numbers carry a people's edge below the top
// and `MYTHIC_EDGE` on the ascended form (data/levels.ts); the town is told, the chronicle remembers, and they carry a
// title (`born`, `title`).

import type { CallingNode, MythicTree } from './callings/kit';
import { MYTHIC_TREES } from './callings/mythic';

export { WANDERER_ROAD } from './callings/mythic';
export type { MythicTree } from './callings/kit';

export const MYTHIC_CALLINGS: readonly MythicTree[] = MYTHIC_TREES;
/** The chance someone taking their first calling takes a mythic one (about one townsperson in four hundred). */
export const MYTHIC_ODDS = 1 / 400;
/** The chance for the child of two ascended parents. */
export const MYTHIC_HEIR_ODDS = 0.25;
/** After someone ascends, the next to take a calling has this chance (the omen is spent either way). */
export const MYTHIC_OMEN_ODDS = 0.2;
/** A mythic calling's edge on its class's numbers and on each evolution, at the ascended form (below it, a people's
 *  own road's: ORIGIN_EDGE and ORIGIN_EVOLVE). */
export const MYTHIC_EDGE = 1.4;
export const MYTHIC_EVOLVE = 1.5;
/** A mythic node's full id: `my_<id>` (the grafted Summoner road keeps its own). */
export const mythicId = (id: string) => `my_${id}`;
/** A mythic tree's written nodes (the base and its own roads to stage 3, not the grafted Summoner road), with full ids. */
export function mythicNodes(t: MythicTree): [string, CallingNode][] {
  const out: [string, CallingNode][] = [[mythicId(t.base.id), t.base]];
  for (const road of t.roads) {
    if (road === 'summoner') continue;
    const [r1, roads2] = road;
    out.push([mythicId(r1.id), r1]);
    for (const [r2, roads3] of roads2) {
      out.push([mythicId(r2.id), r2]);
      for (const r3 of roads3) out.push([mythicId(r3.id), r3]);
    }
  }
  return out;
}
