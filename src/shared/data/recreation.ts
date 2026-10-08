// Recreation (the owner's ask: things for the townsfolk to do, to lift their spirits). Places built for fun, each a
// building merged into BUILDINGS with a small morale of its own while it stands (the best morale building counts, as
// any comfort), and `LEISURE`: what someone does there, how long a visit lasts and the lift it gives (sim/leisure.ts:
// the `relax` task). The theatre, bathhouse and cinema are visited too.

import type { BuildingDef } from './buildings';

/** What is done at a place of leisure (the map's pose: mapPeople.ts). */
export type LeisureActivity = 'dance' | 'spar' | 'fish' | 'play' | 'stroll' | 'watch';

export interface LeisureDef {
  activity: LeisureActivity;
  /** What the Townsfolk tab says they're doing. */
  doing: string;
  /** Inside the building, unseen (the theatre), or out on its ground. */
  indoors?: boolean;
  /** How many at once, how long a visit lasts (hours), the lift to spirits (at once; half of it stays as a reason
   *  for a day) and that reason's words. */
  spots: number;
  hours: number;
  fun: number;
  text: string;
  /** Children come too. */
  children?: boolean;
}

/** The places built for fun. Cheap and early (a green from the start, a yard and a pitch with the first studies),
 *  grander with the ages. */
export const RECREATION_BUILDINGS: readonly BuildingDef[] = [
  { id: 'village_green', name: 'Village Green', layer: 'mid', width: 3, depth: 2, cost: { wood: 8, fiber: 4 }, buildSeconds: 60, purpose: 'Morale: a pole and benches on the green, where the town plays of an evening and the children by day.', morale: [2, 'Games on the green'] },
  { id: 'quoits_pitch', name: 'Quoits Pitch', layer: 'mid', width: 3, depth: 1, cost: { wood: 6, stone: 4 }, buildSeconds: 50, purpose: 'Morale: a peg and rings to throw at, and a rail to lean on.', research: 'woodcutting', morale: [2, 'A game of quoits'] },
  { id: 'sparring_yard', name: 'Sparring Yard', layer: 'mid', width: 3, depth: 2, cost: { wood: 12, hide: 2 }, buildSeconds: 80, purpose: 'Morale: a rack and a post to spar at. Those who train there fight a little better.', research: 'spear_hunting', morale: [2, 'Sparring in the yard'] },
  { id: 'fishing_jetty', name: 'Fishing Jetty', layer: 'mid', width: 2, depth: 1, cost: { wood: 10 }, buildSeconds: 60, purpose: 'Morale: a jetty by the water to sit and fish from. Now and then a fish for the pot.', research: 'fish_traps', shore: true, morale: [2, 'An hour with a rod'] },
  { id: 'pleasure_garden', name: 'Pleasure Garden', layer: 'mid', width: 3, depth: 3, cost: { stone: 16, lumber: 8 }, buildSeconds: 160, purpose: 'Morale: flower beds, a bench and lamps, for a stroll.', research: 'masonry', morale: [4, 'A stroll in the garden'] },
  { id: 'bandstand', name: 'Bandstand', layer: 'mid', width: 3, depth: 2, cost: { lumber: 20, cloth: 6 }, buildSeconds: 180, purpose: "Morale: a stand for the town's musicians, and benches to hear them from.", research: 'market_charters', morale: [5, 'Music at the bandstand'] },
];

/** What is done at each place of leisure, and what it gives. */
export const LEISURE: Readonly<Record<string, LeisureDef>> = {
  village_green: { activity: 'dance', doing: 'Playing on the green', spots: 8, hours: 1, fun: 8, text: 'Games on the green', children: true },
  quoits_pitch: { activity: 'play', doing: 'Playing quoits', spots: 4, hours: 1, fun: 7, text: 'A game of quoits', children: true },
  sparring_yard: { activity: 'spar', doing: 'Sparring in the yard', spots: 4, hours: 1, fun: 7, text: 'A good bout in the yard' },
  fishing_jetty: { activity: 'fish', doing: 'Fishing off the jetty', spots: 3, hours: 1.5, fun: 8, text: 'An hour with a rod' },
  pleasure_garden: { activity: 'stroll', doing: 'Strolling in the garden', spots: 6, hours: 1, fun: 8, text: 'A stroll in the garden' },
  bandstand: { activity: 'dance', doing: 'At the bandstand', spots: 10, hours: 1, fun: 9, text: 'Music at the bandstand', children: true },
  theatre: { activity: 'watch', doing: 'At the play', indoors: true, spots: 12, hours: 2, fun: 10, text: 'A night at the theatre' },
  bathhouse: { activity: 'watch', doing: 'At the baths', indoors: true, spots: 6, hours: 1, fun: 8, text: 'A hot bath' },
  cinema: { activity: 'watch', doing: 'At the pictures', indoors: true, spots: 16, hours: 2, fun: 10, text: 'A night at the pictures' },
};

/** Grown-ups before the town builds places of leisure unasked (a lone founder has a roof to raise first); spirits
 *  low, it builds one whatever its size. */
export const LEISURE_PEOPLE = 3;
export const LOW_SPIRITS = 50;
