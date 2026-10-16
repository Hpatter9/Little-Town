// The town's reasons in plain English (the UI restructure): what it is building, studying and making, and why. Derived
// from the planner's own records each time the snapshot is made, and never saved, so a save and the sim's hashes are as
// they were. Pure: no random draws, nothing written.

import { BUILDING_BY_ID } from '../data/buildings';
import { ITEM_BY_ID } from '../data/items';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { TOPIC_BY_ID } from '../data/research';
import { topicName } from '../data/originResearch';
import type { GameState } from './state';

export interface WhyLines {
  build?: string;
  research?: string;
  craft?: string;
}

/** Why the first order at the workshops was made, from what it is (the planner queues by need: sim/planner.ts planCrafting). */
function craftReason(id: string): string {
  const def = ITEM_BY_ID[id];
  if (!def) return 'the town needs it';
  if (def.makes) {
    const m = Object.keys(def.makes)[0] as Material | undefined;
    return m ? `the town is short of ${(MATERIAL_NAMES[m] ?? m).toLowerCase()}` : 'the town is short of it';
  }
  if (def.slot === 'tool') return 'tools make gathering and building quicker';
  if (def.slot === 'weapon' || def.slot === 'body' || def.slot === 'head' || def.slot === 'offhand') return 'its fighters need arms and armour';
  if (def.id === 'bandage' || def.id === 'poultice') return 'the healers keep a few by';
  if (def.ware) return 'the shop\'s customers want it';
  return 'the town has the makings spare';
}

/** The planner's picks with their reasons, one line each; a pick it hasn't made leaves its line out. */
export function townWhy(s: GameState): WhyLines | undefined {
  const out: WhyLines = {};
  const b = s.plan?.build;
  const bd = b && BUILDING_BY_ID[b.def];
  if (b && bd) out.build = `Building a ${bd.name.toLowerCase()} because ${b.why}.`;
  const r = s.plan?.research;
  const rt = r && TOPIC_BY_ID[r.id];
  if (r && rt) out.research = `Studying ${topicName(rt.id, s.origin)} because ${r.why}.`;
  const o = s.crafting[0];
  if (o && ITEM_BY_ID[o.item]) out.craft = `Making ${ITEM_BY_ID[o.item].name.toLowerCase()} because ${craftReason(o.item)}.`;
  return out.build || out.research || out.craft ? out : undefined;
}
