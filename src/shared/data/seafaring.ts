// Seafaring and islands (sim/seafaring.ts): the sea made a real place. A coastal town builds a harbour beside its
// boatyard, keeps a bigger fleet and sends it fishing after the shoals; ships age and wear, storms at home take boats
// and the men in them; an island chain lies off the coast (the isles below, reached by boat like data/boats.ts's),
// and a prosperous town founds a colony on one; pirates land on the beach, a sea monster hunts the fleet, and wrecks
// wash up loot and castaways. The merfolk have it easiest: their boats come with the town, they parley with the deep,
// and the isles are theirs to claim first. Everything runs off a side stream ('sea') with the autopilot on.

import type { BuildingDef } from './buildings';
import type { BoatDef } from './boats';
import type { Destination } from './expeditions';
import type { RaidKind } from './raids';
import type { SceneId } from './scenes';
import type { Topic } from './research';

/* ------------------------------------------------------------ the harbour, and a galleon */

/** The harbour: quays, a sea wall and a lamp at the water's edge. It shelters the fleet from squalls, brings the catch
 *  in faster (more fish a boat), and lets the town keep more boats. */
export const HARBOUR: BuildingDef = {
  id: 'harbour',
  name: 'Harbour',
  layer: 'mid',
  width: 4,
  cost: { lumber: 20, stone: 14, iron: 2 },
  buildSeconds: 150,
  purpose: 'Quays and a sea wall. Shelters the fleet from squalls, lands a bigger catch, and berths more boats.',
  research: 'shipwrighting',
  shore: true,
  warningMinutes: 20,
};

/** The galleon: the great sailing ship of the age, between the carrack and the steamer. */
export const GALLEON: BoatDef = {
  kind: 'galleon',
  name: 'Galleon',
  era: 'medieval',
  research: 'galleons',
  crew: 6,
  speed: 1.9,
  hull: 150,
  cargo: 45,
  catch: 11,
  cost: { lumber: 60, cloth: 20, iron: 12 },
  seconds: 380,
  description: 'Three masts and a gun deck: she carries a crew of six across the open sea and rides out most storms.',
};
export const SEAFARING_TOPICS: readonly Topic[] = [
  { id: 'galleons', name: 'Galleons', branch: 'logistics', era: 'medieval', seconds: 480, prereqs: ['navigation', 'iron_working'], unlocks: 'The galleon: the great ship of the age', effects: [] },
];

/** Harbour numbers: boats a town may keep (FLEET_MOST + this), the share added to a day's catch, and the share of
 *  squalls it turns away. */
export const HARBOUR_BERTHS = 2;
export const HARBOUR_CATCH = 1.5;
export const HARBOUR_SHELTER = 0.5;

/* ------------------------------------------------------------ ships age */

/** A ship's days of hard use before the sea starts to take her, and then the share of her hull it takes a day (more
 *  with every season past that). A mended hull gains it back each dawn while the town has timber. */
export const AGE_FROM_DAYS = 24;
export const AGE_WEAR = 0.004;
/** A boat at home with her hull gone rots at her moorings and is broken up. */
export const ROT_AT = 0.05;

/* ------------------------------------------------------------ fishing: shoals and losses */

/** Where the shoals are by the season: close inshore (small boats do well) or out in the deep (the big ships do), and
 *  how rich the run is. A boat's ground is her class (dugouts and longboats inshore; carracks and up, the deep). */
export const SHOALS: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', { ground: 'inshore' | 'deep'; rich: number; name: string }>> = {
  spring: { ground: 'inshore', rich: 1.2, name: 'the spring herring' },
  summer: { ground: 'inshore', rich: 1.0, name: 'the summer mackerel' },
  autumn: { ground: 'deep', rich: 1.3, name: 'the autumn cod' },
  winter: { ground: 'deep', rich: 0.6, name: 'the winter shoals' },
};
/** A boat on the wrong ground brings home this share. */
export const WRONG_GROUND = 0.6;
/** A squall that batters a fishing boat may sink her: always when her hull is under this share, else this chance. The
 *  men in her drown (each at this chance; a swimmer, rarely). */
export const SINK_HULL = 0.3;
export const SINK_CHANCE = 0.12;
export const FISHERS_PER_BOAT = [2, 3] as const;
export const FISHER_DROWN = 0.7;
export const FISHER_DROWN_SWIMMER = 0.1;

/* ------------------------------------------------------------ the sea monster, and the deep's friends */

/** A sea monster (the kraken by day 15, a serpent before) hunts the fleet at home: the chance a night with a boat to
 *  take, from this day. The harbour's lamps and a merfolk town's parley cut it. */
export const MONSTER_FROM_DAY = 12;
export const MONSTER_NIGHTLY = 0.035;
export const MONSTER_HARBOUR = 0.6;
export const MONSTER_PARLEY = 0.3;
export const MONSTER_HULL: [number, number] = [0.35, 0.8];
export const MONSTER_NAMES: readonly string[] = ['a sea serpent', 'the Kraken', 'a great squid'];
/** A merfolk town's parley with the deep: now and then a leviathan escorts the fleet, and the catch is richer a day. */
export const PARLEY_DAILY = 0.06;
export const PARLEY_CATCH = 1.4;

/* ------------------------------------------------------------ wrecks that wash up */

/** After a boat goes down, the sea gives some of her back: timber and cloth on the beach, and sometimes a castaway. */
export const WRECK_WASH_CHANCE = 0.7;
export const WRECK_CASTAWAY = 0.35;
export const WASH_LOOT: Readonly<Record<'neolithic' | 'medieval' | 'industrial', Partial<Record<string, [number, number]>>>> = {
  neolithic: { wood: [4, 10], fiber: [1, 4] },
  medieval: { lumber: [4, 10], cloth: [2, 6], iron: [0, 3] },
  industrial: { lumber: [4, 8], steel: [1, 4], cloth: [2, 5] },
};
/** And now and then a wreck of some other ship comes ashore on its own, in autumn and winter, in a day's gales. */
export const DRIFT_DAILY = 0.04;

/* ------------------------------------------------------------ pirates landing */

/** Pirate ships raid a coastal town from the sea, landing on the beach: every PIRATE_GAP days (+- jitter), once the
 *  town has a harbour or a boat and the Medieval age has come; about this share of a land raid's budget. */
export const PIRATE_FROM_DAY = 8;
export const PIRATE_GAP: [number, number] = [9, 16];
export const PIRATE_BUDGET = 0.7;
/** The share of its pirates' strength a harbour's sea wall takes off (the lamp warns, the quay blocks the landing). */
export const SEA_RAID_KIND: RaidKind = {
  id: 'sea_raiders',
  name: 'Pirate crew',
  goal: 'steal',
  goals: { steal: 4, burn: 1, kidnap: 2 },
  steals: 'valuables',
  enemies: { sea_reaver: 12, drowned_sailor: 10 },
  // (never picked at random: sim/seafaring.ts lands them from the sea)
  fromDay: 9999,
  weight: 0,
  speed: 60,
  bribable: true,
  plural: true,
};

/* ------------------------------------------------------------ the isles */

const isle = (d: Omit<Destination, 'scenery' | 'recommendedParty' | 'byBoat'> & { recommendedParty?: number }): Destination => ({ recommendedParty: 3, scenery: 'river', byBoat: true, ...d });
export const SEA_ISLES: readonly Destination[] = [
  isle({ id: 'herring_isle', name: 'Herring Isle', type: 'gather', outSeconds: 280, workSeconds: 150, secondsPerUnit: 4, loot: { fish: 8, kelp: 3, eggs: 2 }, threats: 'Little: the swell, and crocodiles in the creeks', encounters: { arrival: 0.1, ambush: 0.05, groups: [{ enemies: { crocodile: 1 }, weight: 1 }] }, research: 'boatbuilding', recommendedParty: 2, description: 'A green fishing isle off the east coast with a sheltered cove. The shoals run thick there, and its folk smoke fish on racks.' }),
  isle({ id: 'ember_isle', name: 'Ember Isle', type: 'gather', outSeconds: 340, workSeconds: 180, secondsPerUnit: 7, loot: { stone: 6, sulphur: 3, iron_ore: 3, coal: 2 }, threats: 'Fire elementals in the vents; ash storms', encounters: { arrival: 0.35, ambush: 0.15, groups: [{ enemies: { fire_elemental: 1 }, weight: 2 }, { enemies: { fire_elemental: 2 }, weight: 1 }] }, research: 'shipwrighting', era: 'medieval', description: 'A volcano standing out of the sea to the south-east, smoking day and night. Sulphur and iron lie on its slopes, for anyone who can bear the heat.' }),
  isle({ id: 'wreck_isle', name: 'The Wreck Isle', type: 'salvage', outSeconds: 360, workSeconds: 200, secondsPerUnit: 7, loot: { lumber: 6, cloth: 4, iron: 3, silver: 1, gems: 1 }, threats: 'The crews of a hundred wrecks still walk the beach', encounters: { arrival: 0.55, ambush: 0.2, groups: [{ enemies: { drowned_sailor: 3 }, weight: 2 }, { enemies: { drowned_sailor: 2, skeleton_warrior: 2 }, weight: 1 }] }, research: 'navigation', era: 'medieval', description: 'Reefs have piled ships on this rock for centuries. Their masts stand like a forest, and their dead have not left.' }),
  isle({ id: 'tidewrights_isle', name: "The Tidewrights' Isle", type: 'trade', outSeconds: 320, workSeconds: 80, secondsPerUnit: 5, loot: { pearls: 3, fish: 4, kelp: 2, cloth: 2, glass: 1 }, coins: 90, threats: 'None to traders; the harbour master counts every coin', encounters: { arrival: 0, ambush: 0.12, groups: [{ enemies: { sea_reaver: 1 }, weight: 1 }] }, research: 'shipwrighting', era: 'medieval', recommendedParty: 2, description: 'A free port of another people, who live on boats and pile-houses in a lagoon. They trade pearls and netting for cloth and iron, and keep to their own laws.' }),
];
export const SEA_ISLE_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  herring_isle: { x: 705, y: 445 },
  ember_isle: { x: 655, y: 655 },
  wreck_isle: { x: 360, y: 742 },
  tidewrights_isle: { x: 64, y: 520 },
};
export const SEA_ISLE_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = Object.fromEntries(SEA_ISLES.map((d) => [d.id, ['coast', 'coast']]));

/* ------------------------------------------------------------ colonies */

/** An isle a town can settle (a colony works like a daughter village, reached by ship), and what its folk send home. */
export const COLONY_ISLES: Readonly<Record<string, { name: string; makes: Record<string, number>; word: string }>> = {
  herring_isle: { name: 'Herring Cove', makes: { fish: 1.0 }, word: 'fishing' },
  gull_rock: { name: 'Gull Haven', makes: { fish: 0.6, eggs: 0.5 }, word: 'egging and fishing' },
  turtle_atoll: { name: 'Lagoon Landing', makes: { fish: 0.6, pearls: 0.2, kelp: 0.3 }, word: 'diving' },
  seal_skerries: { name: 'Skerry Hold', makes: { hide: 0.5, meat: 0.5 }, word: 'sealing' },
  ember_isle: { name: 'Cinder Hold', makes: { stone: 0.6, sulphur: 0.3 }, word: 'quarrying' },
};
export const COLONY_FROM_DAY = 20;
export const COLONY_FROM_DAY_MERFOLK = 9;
export const COLONY_GAP_DAYS = 14;
export const COLONY_MOST = 2;
export const COLONY_MOST_MERFOLK = 3;
/** Grown-ups the town must have at home, and how many go. */
export const COLONY_PEOPLE = 12;
export const COLONY_PEOPLE_MERFOLK = 7;
export const COLONISTS: [number, number] = [2, 4];
/** What a colony grows a day (share of its folk), its most folk, and what each makes a day, a head. */
export const COLONY_GROWTH = 0.03;
export const COLONY_MOST_FOLK = 24;
export const COLONY_MAKES_PER_HEAD = 0.5;
/** Every few days a ship sails the colony's goods home (the town's ship, at risk of the sea). */
export const COLONY_RUN_DAYS = 3;
export const COLONY_RUN_STORM = 0.12;
/** Loyalty (0-100): where it starts, how it drifts a day (kept up by trade runs, worn by pirates), where it breaks. */
export const COLONY_LOYALTY_START = 70;
export const COLONY_BREAK_AT = 12;
export const COLONY_PIRATES_DAILY = 0.025;
/** The Tide Clan claims the isles for itself in a town that isn't its own: each isle falls to it on a day between these
 *  (a fixed day for the seed). A merfolk town's isles are never claimed. */
export const CLAIM_DAYS: [number, number] = [22, 70];
