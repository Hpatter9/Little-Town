// The shape of a people's own base callings (data/originCallings.ts): the owner's ask, "3 extra base classes per
// origin with the same number of evolutions as the regular classes". Each is a tree like a shared base calling's
// (data/paths.ts BASES): the base, two stage-1 roads, each with two stage-2 roads, each with two stage-3 roads, each
// with its ascended form. Every node stands on an archetype (`cls`, one of the 26 classes), which gives it its gear,
// spells and class skills; the node adds its name, text, lore, signature skill, stat lean, emblem, and how it is drawn
// (`form`) and what it may wield over its archetype's (`arms`), both taken from the nearest node up its road.

import type { ClassId, ClassStats } from '../classes';
import type { OriginId } from '../origins';
import type { Attrs } from '../attributes';
import type { Passive } from '../abilities';
import type { Effect } from '../effects';
import type { FamilyId } from '../weapons';
import type { PackSheetId } from '../packSheets';
import type { EmblemColours, Glyph } from '../emblems';

export { cleanse, dispel, drain, grant, heal, hit, inflict, revive, summon } from '../effects';

/** How a calling is drawn when it fights: a Craftpix hero sheet, or 'doll' (the townsperson as themselves, in their
 *  people's dress, with their weapon in hand). */
export type CallingForm = PackSheetId | 'doll';

export interface CallingNode {
  /** Unique within its people (the full id is `oc_<people>_<id>`). */
  id: string;
  name: string;
  /** The archetype it fights as. */
  cls: ClassId;
  text: string;
  lore: string;
  /** The signature skill: [id (unique within its people), name, passive | [cooldown, effects]]. */
  skill: [string, string, Passive | [number, Effect[]]];
  lean: Partial<Attrs>;
  emblem: { main: Glyph; charge?: Glyph };
  form?: CallingForm;
  /** A weapon kind it may wield on top of its archetype's. */
  arms?: FamilyId;
  companion?: string;
  stats?: Partial<ClassStats>;
}
export interface CallingLeaf extends CallingNode {
  /** Its ascended form: [id, name]. */
  asc: [string, string];
}
export type Road2 = [CallingNode, [CallingLeaf, CallingLeaf]];
export type Road1 = [CallingNode, [Road2, Road2]];
export interface CallingTree {
  origin: OriginId;
  /** The base calling: its form and arms are the line's unless a road sets its own; `behind` the emblem's crossed pair. */
  base: CallingNode & { form: CallingForm; arms: FamilyId; behind: Glyph };
  /** The emblem's field. */
  colours: EmblemColours;
  /** How its crossroads is told as a scene, with {name} for the townsperson. */
  fork: string;
  roads: [Road1, Road1];
}

export const P = (p: Passive) => p;
export const A = (cooldown: number, effects: Effect[]): [number, Effect[]] => [cooldown, effects];

/** How many glyph cells each emblem sheet has (renderer/art/icons.ts: rows of 8, the Magic sheet's of 9). */
export const GLYPH_CELLS: Readonly<Record<Glyph[0], number>> = {
  ShortWep: 40, MedWep: 16, LongWep: 56, Wand: 56, Shield: 8, Hat: 32, Amulet: 24, Scroll: 48, Magic: 45, Tool: 24,
  Light: 8, Potion: 40, Ring: 48, Ammo: 48, Armor: 72, Book: 72, Music: 48, Money: 64,
};

/** A mythic calling (data/mythic.ts): a whole tree like the others, open to anyone but given to very few. */
export interface MythicTree {
  base: CallingTree['base'];
  colours: EmblemColours;
  fork: string;
  /** What the chronicle and the news say when one appears: {name} the townsperson, {town} the town. */
  born: string;
  /** The title they carry from then on. */
  title: string;
  /** Its two stage-1 roads; 'summoner' grafts the shared tree's Summoner road (and all after it) on here. */
  roads: [Road1 | 'summoner', Road1];
}
/** A Road1's written nodes, the stage-1 first, each with its stage. */
export function roadNodes(road: Road1): [CallingNode, number][] {
  const [r1, roads2] = road;
  const out: [CallingNode, number][] = [[r1, 1]];
  for (const [r2, roads3] of roads2) {
    out.push([r2, 2]);
    for (const r3 of roads3) out.push([r3, 3]);
  }
  return out;
}
