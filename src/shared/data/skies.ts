// The skies (the owner's ask: a DLC-sized update). From the Industrial age a town can build airships at an airship
// mast and fly its parties anywhere, further and faster than on foot or by boat; the sky has its own dangers (storms,
// being shot down, sky pirates, things with wings), and losses are real. Sky pirates raid towns that fly (and any
// town from the Modern age), dropping in from their own ship; flying creatures hunt the townsfolk out in the open.
// The rules are in sim/skies.ts; merged into the game's lists by research.ts, buildings.ts, items.ts,
// expeditions.ts, worldMap.ts, scenes.ts, enemies.ts and raids.ts.

import type { BuildingDef } from './buildings';
import type { EnemyDef, EnemyGroup } from './enemies';
import type { Era } from './eras';
import type { Destination } from './expeditions';
import type { ItemDef } from './items';
import type { Material } from './materials';
import { PACK_SHEETS, type PackSheetId } from './packSheets';
import type { RaidKind } from './raids';
import type { Topic } from './research';
import type { SceneId } from './scenes';

export type AirshipKind = 'dirigible' | 'zeppelin' | 'sky_cruiser' | 'sky_frigate';

export interface AirshipDef {
  kind: AirshipKind;
  name: string;
  era: Era;
  research: string;
  /** How many fly in her, how much faster than walking a trip goes, her hull, and what she carries over the party's
   *  own packs. */
  crew: number;
  speed: number;
  hull: number;
  cargo: number;
  /** Her guns: the share of a sky fight's foes she drives off before it comes to blows (pirates and flyers). */
  guns: number;
  cost: Partial<Record<Material, number>>;
  seconds: number;
  description: string;
}

export const AIRSHIPS: readonly AirshipDef[] = [
  { kind: 'dirigible', name: 'Dirigible', era: 'industrial', research: 'aeronautics', crew: 4, speed: 1.9, hull: 60, cargo: 16, guns: 0, cost: { cloth: 16, steel: 6, lumber: 10, coal: 6 }, seconds: 300, description: 'A gasbag of doped cloth over a wicker gondola and a little steam engine. She flies when the wind lets her.' },
  { kind: 'zeppelin', name: 'Zeppelin', era: 'industrial', research: 'rigid_airships', crew: 5, speed: 2.3, hull: 110, cargo: 28, guns: 0.15, cost: { cloth: 24, steel: 16, coal: 10 }, seconds: 400, description: 'A rigid steel frame inside the gasbag, a cabin slung beneath, and a brace of guns.' },
  { kind: 'sky_cruiser', name: 'Sky Cruiser', era: 'modern', research: 'air_cruisers', crew: 6, speed: 2.9, hull: 170, cargo: 40, guns: 0.25, cost: { steel: 22, cloth: 16, fuel: 12, electronics: 2 }, seconds: 420, description: 'A great armoured airship with diesel screws and a wheelhouse: she shrugs off weather that grounds the rest.' },
  { kind: 'sky_frigate', name: 'Sky Frigate', era: 'space', research: 'skyships', crew: 6, speed: 3.7, hull: 240, cargo: 55, guns: 0.35, cost: { alloys: 14, circuits: 4, power_cells: 6 }, seconds: 460, description: 'No gasbag at all: she rides on lift engines, quick as a falcon and armed like a fortress.' },
];
export const AIRSHIP_BY_KIND: Readonly<Record<AirshipKind, AirshipDef>> = Object.fromEntries(AIRSHIPS.map((a) => [a.kind, a])) as Record<AirshipKind, AirshipDef>;

const topic = (id: string, name: string, era: Era, seconds: number, prereqs: string[], unlocks: string): Topic => ({ id, name, branch: 'logistics', era, seconds, prereqs, unlocks, effects: [] });
export const SKY_TOPICS: readonly Topic[] = [
  topic('aeronautics', 'Aeronautics', 'industrial', 480, ['steam_power', 'cartography'], 'The airship mast and the dirigible: parties fly anywhere, faster, and reach the Cloud Isles'),
  topic('rigid_airships', 'Rigid Airships', 'industrial', 540, ['aeronautics', 'steelmaking'], "The zeppelin: a crew of five, guns, and the sky's far places"),
  topic('air_cruisers', 'Air Cruisers', 'modern', 480, ['rigid_airships', 'motor_transport'], 'The sky cruiser, and the Storm Crown'),
  topic('skyships', 'Skyships', 'space', 520, ['air_cruisers', 'advanced_alloys'], 'The sky frigate'),
];

/** The airship mast: a tall tower with a mooring head, where the town's airships are built, moored and mended. */
export const AIRSHIP_MAST: BuildingDef = {
  id: 'airship_mast',
  name: 'Airship Mast',
  layer: 'mid',
  width: 3,
  cost: { steel: 10, lumber: 12, cloth: 6 },
  buildSeconds: 140,
  purpose: "Builds, moors and mends the town's airships. An airship carries a party anywhere, far faster than on foot.",
  research: 'aeronautics',
};

/** An airship to build at the mast (she goes to the fleet, not the stores: sim/skies.ts `launchAirship`). */
export const AIRSHIP_ITEMS: readonly ItemDef[] = AIRSHIPS.map((a) => ({
  id: `airship_${a.kind}`,
  name: a.name,
  slot: null,
  station: 'airship_mast',
  cost: a.cost,
  seconds: a.seconds,
  research: [a.research],
  effects: {},
  airship: a.kind,
  description: `${a.description} Crew ${a.crew}, hull ${a.hull}.`,
  icon: { sheet: 'Custom', x: 0, y: 0, name: `airship_${a.kind}` },
}));

/* ------------------------------------------------------------ the sky pirates */

const sprite = (sheet: PackSheetId, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });
const PERSON = 46;

export const SKY_ENEMIES: Record<string, EnemyDef> = {
  sky_pirate: { id: 'sky_pirate', name: 'Sky Pirate', hp: 58, damage: [7, 12], accuracy: 0.72, dodge: 0.18, interval: 1.0, ranged: false, loot: { cloth: 1, steel: 1 }, sprite: sprite('pirate_leader', PERSON - 2), look: { hue: 250 } },
  sky_gunner: { id: 'sky_gunner', name: 'Sky Gunner', hp: 64, damage: [11, 17], accuracy: 0.74, dodge: 0.12, interval: 1.5, ranged: true, loot: { shot: 4, steel: 1 }, sprite: sprite('pirate_leader', PERSON), look: { hue: 160 } },
  sky_bombardier: { id: 'sky_bombardier', name: 'Sky Bombardier', hp: 90, damage: [15, 24], accuracy: 0.7, dodge: 0.08, interval: 1.9, ranged: true, loot: { coal: 2, steel: 2 }, sprite: sprite('pirate_leader', PERSON + 4), look: { hue: 20, bright: 0.85 } },
  captain_gale: {
    id: 'captain_gale', name: 'Captain Hesper Gale', hp: 420, damage: [14, 22], accuracy: 0.82, dodge: 0.22, interval: 1.1, ranged: true, boss: true, loot: { steel: 6, cloth: 6, silver: 2, gems: 1 }, sprite: sprite('pirate_leader', 76), look: { hue: 280, bright: 1.1 },
    kit: { roar: 'A rope ladder slaps down out of the clouds. Captain Gale slides down it one-handed: "Your gold, your guns and your best coat. Quickly now."', enrage: 'Gale laughs and whistles: her ship\'s guns open up from the clouds!', area: { every: 3, targets: 3, name: 'calls down a broadside from the clouds', burns: true, fx: 'shell' }, summon: { kind: 'sky_pirate', count: 2, text: 'More pirates come sliding down the ropes!' }, trophy: 'gale_storm_saber' },
  },
};

/** Captain Gale's trophy (merged into ITEMS: a relic, never made or sold). */
export const SKY_TROPHIES: ItemDef[] = [
  { id: 'gale_storm_saber', name: "Gale's Storm Saber", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { range: 1.2, damage: 18, crit: 0.12, speed: 0.12, morale: 3 }, description: 'A sky pirate\'s sabre, its blade blued like a storm cloud. It is never where an enemy expects it.', icon: { sheet: 'MedWep', x: 1, y: 0 } },
];

/** Their raids, by the age (never rolled: sim/skies.ts sends them, dropping in from their ship). */
const pirates = (id: string, era: Era, untilEra: Era, enemies: Record<string, number>): RaidKind => ({ id, name: 'Sky pirates', goal: 'steal', goals: { steal: 4, kidnap: 1, burn: 1 }, steals: 'valuables', enemies, fromDay: 9999, era, untilEra, weight: 0, speed: 70, bribable: true, plural: true });
export const SKY_RAIDS: readonly RaidKind[] = [
  pirates('sky_pirates_industrial', 'industrial', 'industrial', { sky_pirate: 12, sky_gunner: 14 }),
  pirates('sky_pirates_modern', 'modern', 'modern', { sky_pirate: 12, sky_gunner: 14, sky_bombardier: 20 }),
  pirates('sky_pirates_space', 'space', 'space', { sky_gunner: 14, sky_bombardier: 20, space_pirate: 30 }),
];
export const skyRaidFor = (era: Era): string => (era === 'space' ? 'sky_pirates_space' : era === 'modern' ? 'sky_pirates_modern' : 'sky_pirates_industrial');

/* ------------------------------------------------------------ the far places only an airship reaches */

const sky = (d: Omit<Destination, 'scenery' | 'recommendedParty'> & { recommendedParty?: number }): Destination => ({ recommendedParty: 3, scenery: 'quarry', bySky: true, ...d });
export const SKY_PLACES: readonly Destination[] = [
  sky({ id: 'cloud_isles', name: 'The Cloud Isles', type: 'gather', outSeconds: 300, workSeconds: 160, secondsPerUnit: 5, loot: { herbs: 4, fruit: 4, gems: 1, silver: 1 }, threats: 'Harpies nest on the crags', encounters: { arrival: 0.3, ambush: 0.1, groups: [{ enemies: { harpy: 2 }, weight: 2 }, { enemies: { harpy_eagle: 1, harpy: 1 }, weight: 1 }] }, research: 'aeronautics', era: 'industrial', description: 'Rocks that float above the clouds, green on top and trailing roots below. Nobody has walked there in living memory.' }),
  sky({ id: 'gales_roost', name: "Gale's Roost", type: 'legendary', outSeconds: 380, workSeconds: 200, secondsPerUnit: 7, loot: { steel: 4, cloth: 4, silver: 2, gems: 1 }, guaranteed: { steel: 6, silver: 2 }, threats: 'Captain Gale (boss) and her sky pirates', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { captain_gale: 1, sky_pirate: 2, sky_gunner: 1 }, weight: 1 }] }, research: 'rigid_airships', era: 'industrial', recommendedParty: 4, description: "The sky pirates' hidden harbour: a ring of old balloons moored to a mountaintop, guns on every ledge. Clear it and they stay away a long while." }),
  sky({ id: 'roc_eyrie', name: "The Roc's Eyrie", type: 'legendary', outSeconds: 360, workSeconds: 180, secondsPerUnit: 7, loot: { bone: 6, hide: 4, meat: 6, gems: 1 }, guaranteed: { bone: 8, gems: 2 }, threats: 'The Roc (boss) and its brood', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { roc: 1, harpy_eagle: 2 }, weight: 1 }] }, research: 'rigid_airships', era: 'industrial', recommendedParty: 4, description: 'A nest the size of a field on a needle of rock. The bones of whole herds lie in it, and the odd airship.' }),
  sky({ id: 'storm_crown', name: 'The Storm Crown', type: 'legendary', outSeconds: 420, workSeconds: 220, secondsPerUnit: 8, loot: { power_cells: 4, gems: 2, silver: 3 }, guaranteed: { power_cells: 6, gems: 2 }, threats: 'The Thunderbird (boss) and the storm itself', encounters: { arrival: 1, ambush: 0.2, groups: [{ enemies: { thunderbird: 1, storm_spirit: 2 }, weight: 1 }] }, research: 'air_cruisers', era: 'modern', recommendedParty: 5, description: 'An eye of calm in a storm that never ends, high over the eastern sea. Lightning hangs there like fruit.' }),
];
export const SKY_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  cloud_isles: { x: 548, y: 118 },
  gales_roost: { x: 120, y: 160 },
  roc_eyrie: { x: 240, y: 92 },
  storm_crown: { x: 700, y: 236 },
};
export const SKY_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = { cloud_isles: ['highlands', 'highlands'], gales_roost: ['highlands', 'highlands'], roc_eyrie: ['highlands', 'highlands'], storm_crown: ['crater', 'crater'] };

/* ------------------------------------------------------------ in the air, and at home */

/** A storm's chance an hour aloft, by the season, and what it does to her hull (a share of it). */
export const SKY_STORM_HOURLY: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', number>> = { spring: 0.02, summer: 0.015, autumn: 0.03, winter: 0.05 };
export const SKY_STORM_HURT: [number, number] = [0.12, 0.32];
/** A bad storm (more than this share at once) may throw someone from the gondola: always fatal at that height but on
 *  the chance they catch a line. */
export const THROWN_AT = 0.26;
export const THROWN = 0.2;
export const CAUGHT_A_LINE = 0.4;
/** Pirates and flyers an hour aloft (pirates from the Industrial age, as she is); the guns of a power at war with the
 *  town an hour (from the Industrial age), and what a hit does to her hull. */
export const SKY_PIRATE_HOURLY = 0.012;
export const FLYER_HOURLY = 0.018;
export const FLAK_HOURLY = 0.03;
export const FLAK_HURT: [number, number] = [0.15, 0.4];
/** Shot down or torn apart: she falls. Each aboard dies on this chance; the rest walk home with nothing. */
export const CRASH_KILLS = 0.45;
/** Mended at the mast each dawn: this share of her hull, for a unit of steel or cloth. */
export const SKY_REPAIR_SHARE = 0.25;
/** She flies only above this share of her hull. */
export const AIRWORTHY = 0.5;
/** The most airships a town keeps (the worst is broken up past it). */
export const AIRSHIPS_MOST = 3;
/** A trip flies only when the party fits in her; the full moon's hunt always runs on foot. */
export const SKY_SEAT_SLACK = 0;

/** Who meets a ship in the air, by the age. */
export const SKY_FLYERS: Readonly<Record<Era, EnemyGroup[]>> = {
  neolithic: [{ harpy: 2 }],
  medieval: [{ harpy: 2 }],
  industrial: [{ harpy: 2 }, { harpy_eagle: 2 }, { storm_bat: 2 }],
  modern: [{ harpy: 3 }, { storm_griffon: 1 }, { storm_bat: 3 }],
  space: [{ storm_griffon: 2 }, { thunderbird: 1 }],
};
export const SKY_PIRATE_GROUP: Readonly<Record<Era, EnemyGroup>> = {
  neolithic: { sky_pirate: 2 },
  medieval: { sky_pirate: 2 },
  industrial: { sky_pirate: 2, sky_gunner: 1 },
  modern: { sky_pirate: 2, sky_gunner: 1, sky_bombardier: 1 },
  space: { sky_gunner: 2, sky_bombardier: 1, space_pirate: 1 },
};

/* ------------------------------------------------------------ sky pirates raid the town */

/** From this day (0-based, paced) a town that flies, or any town from `SKY_PIRATES_ERA`, may be raided from the sky:
 *  checked hourly on this chance, no sooner than `SKY_RAID_GAP_DAYS` after the last, and only in place of a raid due
 *  within `SKY_RAID_DUE` hours (as a nest's raid comes). Their ship is seen `SKY_WARNING_HOURS` before they drop in. */
export const SKY_RAID_FROM_DAY = 3;
export const SKY_PIRATES_ERA: Era = 'modern';
export const SKY_RAID_HOURLY = 0.06;
export const SKY_RAID_GAP_DAYS = 6;
export const SKY_RAID_DUE = 24;
export const SKY_WARNING_HOURS = 1;
/** Their raid's budget, a share of an ordinary raid's (they come by rope: fewer, harder). */
export const SKY_RAID_SHARE = 0.7;
/** Gale's Roost cleared: no sky pirates for this many days. */
export const ROOST_QUIET_DAYS = 20;

/* ------------------------------------------------------------ things with wings, hunting the town */

/** Who hunts from the sky, by the age: by day the birds, by night the bats (their groups as a fight's foes). */
export const SKY_HUNTERS: Readonly<Record<Era, { day: EnemyGroup[]; night: EnemyGroup[] }>> = {
  neolithic: { day: [{ carrion_crow: 3 }, { bald_eagle: 1 }, { vulture: 2 }], night: [{ cave_bat: 3 }] },
  medieval: { day: [{ harpy: 2 }, { bald_eagle: 2 }, { harpy_eagle: 1 }], night: [{ giant_bat: 1 }, { blood_bat: 3 }] },
  industrial: { day: [{ harpy: 3 }, { harpy_eagle: 2 }, { storm_griffon: 1 }], night: [{ giant_bat: 2 }, { storm_bat: 2 }] },
  modern: { day: [{ storm_griffon: 1, harpy: 2 }, { harpy_eagle: 3 }], night: [{ storm_bat: 3 }, { giant_bat: 2 }] },
  space: { day: [{ storm_griffon: 2 }, { roc: 1 }], night: [{ storm_bat: 4 }] },
};
/** From this day (0-based) in a town of `SKY_HUNT_PEOPLE` grown-ups, hourly on this chance (more in the highlands),
 *  at most `SKY_HUNTERS_MOST` at once; each circles for `SKY_HUNT_HOURS` and gives up. */
export const SKY_HUNT_FIRST_DAY = 5;
export const SKY_HUNT_PEOPLE = 4;
export const SKY_HUNT_HOURLY = 0.006;
export const SKY_HUNT_HIGHLANDS = 1.8;
export const SKY_HUNTERS_MOST = 1;
export const SKY_HUNT_HOURS: [number, number] = [6, 14];
/** In the air it flies over walls, water and roofs (px a tick: people walk 4.8): it circles slowly and swoops fast.
 *  It sees prey this far (cells) and keeps within this of where it came. A roof (indoors, asleep in bed, at the
 *  tavern, sheltering) is the only cover; walls are none. */
export const CIRCLE_PACE = 2;
export const SWOOP_PACE = 7;
export const SKY_SEE_CELLS = 9;
export const SKY_RANGE_CELLS = 26;
/** The town shoots back while it's within `VOLLEY_CELLS` of a shooter: every `VOLLEY_TICKS`, each defence engine and
 *  each grown-up with a bow, gun or spell at home within reach hits on `VOLLEY_HIT`, a hit taking `VOLLEY_HURT` of it;
 *  hurt to `FLEE_AT` it flies off, to 1 it falls (and its carcass is brought in). */
export const VOLLEY_CELLS = 7;
export const VOLLEY_TICKS = 40;
export const VOLLEY_HIT = 0.1;
export const VOLLEY_HURT = 0.22;
export const FLEE_AT = 0.7;
/** How high a flyer is drawn over the ground (px), circling and at the bottom of a swoop. */
export const FLY_HIGH = 46;
export const FLY_LOW = 10;

/** Names for the town's airships (by the number built, in turn). */
export const AIRSHIP_NAMES: readonly string[] = [
  'Cloud Dancer', 'Brass Heron', 'Zephyr', 'High Hope', 'Skylark', 'Thunderhead', 'Gossamer', 'Iron Kite', 'Wayfarer', 'Swallow',
  'Stormcrow', 'Lady Aurora', 'North Star', 'Windlass', 'Sunchaser', 'Old Gasbag', 'Albatross', 'Silver Cirrus', 'Dauntless', 'Morning Mist',
];
