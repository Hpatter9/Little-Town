// The realm: the other powers round the town, and how the town stands with each. Every rival origin the player didn't
// choose (data/rivals.ts) may be one, with the bandit lords of the Red Brotherhood besides. Each has a lord, a
// stronghold, a temper that colours what it does (the warlike want war, the greedy want coin, the honourable keep
// their word, the treacherous don't), its troops (which grow day by day and fall in battle), and a stance toward the
// town: at war, no treaty, at peace, trading, allied, a vassal, or destroyed. See sim/factions.ts.
// Numbers are starting points for tuning.

import type { EnemyDef } from './enemies';
import type { OriginId } from './origins';
import { PACK_SHEETS } from './packSheets';
import { RIVALS } from './rivals';
import type { SceneId } from './scenes';
import type { Rng } from '../rng';

export type RealmStance = 'war' | 'neutral' | 'peace' | 'trade' | 'alliance' | 'vassal' | 'destroyed';
export type Temper = 'warlike' | 'greedy' | 'honourable' | 'treacherous';

export interface FactionDef {
  id: string;
  /** Its people, when it is one of the origins. */
  origin?: Exclude<OriginId, 'settlers'>;
  name: string;
  /** Its raid kind (data/raids.ts): what its hosts are made of. */
  raid: string;
  /** Its lord (an enemy id), who leads its hosts and waits at the end of an assault. */
  lord: string;
  /** Its seat, and the scenes on the road there and inside (the watched assault). */
  stronghold: string;
  road: SceneId;
  inside: SceneId;
  /** The temper it most likely has (the town's seed may give it another). */
  temper: Temper;
  /** What a vassal of it pays, or a trade treaty brings, besides coin. */
  goods: string;
}

const STRONGHOLDS: Record<Exclude<OriginId, 'settlers'>, [string, SceneId, SceneId, Temper, string]> = {
  lich: ['the Barrow Throne', 'burned_village', 'crypt', 'warlike', 'bone'],
  druid: ['the Elder Grove', 'pinewoods', 'ruins', 'honourable', 'herbs'],
  vampire: ['Castle Nachtmar', 'highlands', 'keep', 'treacherous', 'cloth'],
  werewolf: ['the Howling Tor', 'highlands', 'cave', 'warlike', 'hide'],
  robot: ['the Foundry Core', 'ghost_city', 'factory', 'warlike', 'iron'],
  dwarves: ['Karak Dun', 'quarry', 'vault', 'greedy', 'iron'],
  merfolk: ['the Coral Keep', 'coast', 'ship_hold', 'honourable', 'fish'],
  nomads: ["the Khan's Ordu", 'dunes', 'bandit_camp', 'greedy', 'hide'],
  fae: ['the Hollow Hill', 'meadow', 'ruins', 'treacherous', 'herbs'],
  alchemists: ['the Black Tower', 'coal_fields', 'keep', 'greedy', 'tools'],
  knights: ['the Citadel of the Order', 'meadow', 'keep', 'honourable', 'iron'],
};

const RAID_NAMES: Record<Exclude<OriginId, 'settlers'>, string> = {
  lich: 'The Lich Lord\'s Dominion',
  druid: 'The Circle of the Wild',
  vampire: 'The Blood Court',
  werewolf: 'The Moon Pack',
  robot: 'The Machine Colony',
  dwarves: 'The Deep Hold',
  merfolk: 'The Tide Clan',
  nomads: 'The Horde',
  fae: 'The Wild Hunt',
  alchemists: 'The Black Tower',
  knights: 'The Order',
};

/** Every power there may be: the rival origins, and the bandits. */
export const FACTION_DEFS: readonly FactionDef[] = [
  ...(Object.keys(RIVALS) as Exclude<OriginId, 'settlers'>[]).map((o) => {
    const [stronghold, road, inside, temper, goods] = STRONGHOLDS[o];
    return { id: o, origin: o, name: RAID_NAMES[o], raid: RIVALS[o].raid, lord: RIVALS[o].leader, stronghold, road, inside, temper, goods };
  }),
  { id: 'brotherhood', name: 'The Red Brotherhood', raid: 'bandits', lord: 'bandit_chief', stronghold: 'Gallows Hold', road: 'bandit_camp', inside: 'keep', temper: 'greedy', goods: 'iron' },
];
/** Where each power's stronghold stands on the world map (768px square, data/worldMap.ts). */
export const STRONGHOLD_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  lich: { x: 40, y: 150 }, druid: { x: 740, y: 80 }, vampire: { x: 420, y: 80 }, werewolf: { x: 740, y: 300 },
  robot: { x: 740, y: 530 }, dwarves: { x: 80, y: 200 }, merfolk: { x: 600, y: 740 }, nomads: { x: 30, y: 470 },
  fae: { x: 600, y: 200 }, alchemists: { x: 440, y: 250 }, knights: { x: 250, y: 290 }, brotherhood: { x: 130, y: 480 },
};
export const FACTION_BY_ID: Readonly<Record<string, FactionDef>> = Object.fromEntries(FACTION_DEFS.map((f) => [f.id, f]));

/** The rival powers of a world: `count` of them drawn by `rng` from the origins the town isn't, the bandits taking
 *  the last place once there are three or more (the same draws whatever asks, so the realm and the conquest agree). */
export function pickRivals(rng: Rng, own: OriginId, count: number): FactionDef[] {
  const pool = FACTION_DEFS.filter((d) => d.origin !== own && d.id !== 'brotherhood');
  const bandits = count >= 3 ? 1 : 0;
  const picked: FactionDef[] = [];
  while (picked.length < count - bandits && pool.length) picked.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  if (bandits) picked.push(FACTION_BY_ID.brotherhood); // (the bandits are everywhere)
  return picked;
}

/** How many powers a town shares its realm with, and when it meets them (game days, then one more every few). */
export const FACTION_COUNT = 4;
export const FIRST_MEET_DAY = 2;
export const MEET_EVERY_DAYS = 3;

/** Troops: where each starts, how many it gains a day, and the most it can field. */
export const TROOPS_START: [number, number] = [18, 30];
export const TROOPS_PER_DAY = 1.6;
export const TROOPS_MOST = 140;
/** The powers' own towns, growing on the world map (sim/factions.ts `growTowns`): the folk they start with, their
 *  growth a day (a share, by how they stand with the town), what a broken host and a storming cost them, and the size
 *  each is called by (`TOWN_TIERS`: at least this many folk). */
export const FOLK_START: [number, number] = [10, 24];
export const FOLK_GROWTH = 0.05;
export const FOLK_GROWTH_BY: Readonly<Record<string, number>> = { war: 0.4, vassal: 0.7, trade: 1.3, alliance: 1.4 };
export const FOLK_MOST = 600;
export const FOLK_HOST_LOST = 0.88;
export const FOLK_STORMED = 0.6;
export const TOWN_TIERS: readonly [number, string][] = [
  [0, 'camp'],
  [20, 'village'],
  [45, 'town'],
  [100, 'city'],
  [220, 'capital'],
];
/** The size a power's town is called by, and its tier (0 a camp to 4 a capital). */
export function townTier(folk: number): { tier: number; name: string } {
  let tier = 0;
  for (let i = 0; i < TOWN_TIERS.length; i++) if (folk >= TOWN_TIERS[i][0]) tier = i;
  return { tier, name: TOWN_TIERS[tier][1] };
}

/** Attitude (-100 hostile to 100 devoted): where each temper settles, and how fast it drifts back there a day. */
export const TEMPER_REST: Record<Temper, number> = { warlike: -35, greedy: -10, honourable: 10, treacherous: 5 };
export const ATTITUDE_DRIFT = 3;
/** A treaty warms them a little each day; a marriage more. */
export const TREATY_WARMTH: Partial<Record<RealmStance, number>> = { peace: 1, trade: 2, alliance: 3 };
export const MARRIAGE_WARMTH = 1;
/** Below this, a power with no treaty declares war. */
export const WAR_AT = -50;

/** What the town may ask, and the attitude each needs (from the stance before it). */
export const TREATY_NEEDS: Record<'peace' | 'trade' | 'alliance', number> = { peace: -15, trade: 15, alliance: 40 };
/** A gift: coins from the treasury, and what it buys in goodwill (the greedy more). */
export const GIFT_COINS = 25;
export const GIFT_WARMTH = 10;
export const GREEDY_GIFT = 1.5;
/** A trade treaty's coins a day each way (from the caravans that pass), and a vassal's tribute a day by its troops. */
export const TRADE_COINS = 6;
export const TRIBUTE_PER_TROOPS = 0.15;
export const TRIBUTE_MOST = 30;
/** A vassal rebels when it has the troops again and no love left: the daily chance. */
export const REBEL_CHANCE = 0.12;
/** The treacherous may break a treaty when they feel strong enough: the daily chance. */
export const BETRAY_CHANCE = 0.04;
/** Breaking a treaty yourself: what every other power thinks of it. */
export const OATHBREAKER = 12;

/** Envoys: at most one waiting at a time, none from a power more often than this, how long one waits for an answer. */
export const ENVOY_GAP_DAYS = 2;
export const ENVOY_HOURS = 8;
/** A demand for tribute: coins, by the troops behind it. */
export const DEMAND_BASE = 30;
export const DEMAND_PER_TROOPS = 1;

/** War hosts: the daily chance a power at war musters one, how long the town has before it comes (hours), the most in
 *  one, the share of its troops it sends, and how long before the next. */
export const HOST_CHANCE = 0.22;
export const HOST_WARNING_HOURS = 36;
export const HOST_MOST = 60;
export const HOST_SHARE = 0.6;
export const HOST_GAP_DAYS = 4;
/** The fewest troops a host is worth mustering. */
export const HOST_LEAST = 12;
/** One siege engine for every so many in a host, from the Medieval age. */
export const SIEGE_EVERY = 12;
/** How far (battle-map cells) a siege engine's blows reach, and how long a tower it strikes falls silent (s). */
export const SIEGE_REACH = 4;
export const SIEGE_SILENCE = 20;
/** How much harder a siege engine strikes walls and gates. */
export const SIEGE_WALL = 6;
/** An ally sends this many of its troops when the town is attacked by a host (and some for any raid). */
export const ALLY_TROOPS: [number, number] = [4, 8];
/** A host's waves: up to this many, of about this many each. */
export const HOST_WAVES = 8;
export const HOST_WAVE_SIZE = 8;

/** Assaults: the most the town may send, the troops each wave of defenders is, and the waves before the lord's. */
export const ASSAULT_MOST = 16;
export const ASSAULT_WAVE_TROOPS = 10;
export const ASSAULT_WAVES_MOST = 6;
/** Plunder from a stormed stronghold: coins by its troops before the assault, and goods. */
export const PLUNDER_PER_TROOP = 4;
export const PLUNDER_GOODS = 20;
/** Of a broken power's folk, the share that may come to join the town. */
export const RECRUITS: [number, number] = [1, 3];

/** The siege engine (merged into ENEMIES): slow, tough, and terrible to walls. Drawn as the Himeko pack's juggernaut. */
export const SIEGE_ENEMIES: Record<string, EnemyDef> = {
  siege_engine: {
    id: 'siege_engine',
    name: 'Siege Engine',
    hp: 260,
    damage: [14, 24],
    accuracy: 0.55,
    dodge: 0,
    interval: 2.6,
    ranged: false,
    loot: { wood: 6, iron: 3 },
    sprite: { sheet: 'hk_juggernaut', block: 0, scale: +(84 / PACK_SHEETS.hk_juggernaut).toFixed(2) },
    nature: 'machine',
    armor: 0.3,
  },
};

/** Words for each stance, for the Realm. */
export const STANCE_NAME: Record<RealmStance, string> = { war: 'At war', neutral: 'No treaty', peace: 'At peace', trade: 'Trading', alliance: 'Allied', vassal: 'Our vassal', destroyed: 'Destroyed' };
export const TEMPER_NAME: Record<Temper, string> = { warlike: 'Warlike', greedy: 'Greedy', honourable: 'Honourable', treacherous: 'Treacherous' };
