// Minerals (the owner's ask): copper, tin, silver and sulphur, had by digging the land's caves once they're cleared
// (sim/places.ts: a cave becomes a mine), from the travellers at the shop, from other peoples' caravans at the market
// (data/trade.ts FACTION_GOODS) and by trade caravans the town sends out (TRADE_DESTINATIONS, below). Smelted and
// cast at the kiln and the bloomery, worked into wares at the workbench, the jeweller's and the apothecary.
import type { BuildingDef } from './buildings';
import type { Destination } from './expeditions';
import type { IconSheet, ItemDef, Station, WareTier } from './items';
import type { Material } from './materials';
import { HOME_REGION, REGION_BY_ID, REGIONS, type Region } from './regions';

const HOME = REGION_BY_ID[HOME_REGION];
import type { Topic } from './research';

type Icon = ItemDef['icon'];
const ic = (sheet: IconSheet, x: number, y: number): Icon => ({ sheet, x, y });

/** The ores and what's refined from them. */
export const ORES: readonly Material[] = ['copper_ore', 'tin_ore', 'silver_ore', 'sulphur'];
export const MINERALS: readonly Material[] = [...ORES, 'copper', 'bronze', 'silver'];

export const MINERAL_TOPICS: readonly Topic[] = [
  { id: 'bronze_working', name: 'Bronze Working', branch: 'crafting', era: 'neolithic', seconds: 240, prereqs: ['pottery'], unlocks: 'Copper smelted at the kiln and cast with tin into bronze: kettles, mirrors, a bell tower', effects: [] },
  { id: 'silversmithing', name: 'Silversmithing', branch: 'crafting', era: 'medieval', seconds: 360, prereqs: ['jewellery'], unlocks: 'Silver smelted at the bloomery and worked into rings and chalices', effects: [] },
];

type Cost = Partial<Record<Material, number>>;
const base = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], description: string, icon: Icon): ItemDef => ({ id, name, slot: null, station, cost, seconds, research, effects: {}, description, icon });
const makes = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], out: Cost, text: string, icon: Icon): ItemDef => ({ ...base(id, name, station, cost, seconds, research, text, icon), makes: out });
const ware = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], tier: WareTier, price: number, text: string, icon: Icon): ItemDef => ({
  ...base(id, name, station, cost, seconds, ['barter', ...research], `A ware for the shop: ${text} ${price} coins.`, icon),
  ware: { tier, price },
});

export const MINERAL_ITEMS: readonly ItemDef[] = [
  makes('smelt_copper', 'Copper', 'kiln', { copper_ore: 2, wood: 1 }, 50, ['bronze_working'], { copper: 1 }, 'Copper ore roasted in the kiln: a bar of copper from two of ore.', ic('Rock', 2, 0)),
  makes('cast_bronze', 'Bronze', 'kiln', { copper: 2, tin_ore: 1 }, 60, ['bronze_working'], { bronze: 2 }, 'Copper and tin melted together: two bars of bronze.', ic('Rock', 3, 0)),
  makes('smelt_silver', 'Silver', 'bloomery', { silver_ore: 2, coal: 1 }, 70, ['silversmithing'], { silver: 1 }, 'Silver ore smelted hot with coal: a bar of silver.', ic('Rock', 4, 0)),
  ware('copper_kettle', 'Copper Kettle', 'workbench', { copper: 2 }, 50, ['bronze_working'], 1, 14, 'a kettle beaten from copper.', ic('Tool', 1, 1)),
  ware('bronze_mirror', 'Bronze Mirror', 'workbench', { bronze: 2 }, 80, ['bronze_working'], 2, 26, 'a polished disc of bronze.', ic('Amulet', 4, 0)),
  ware('silver_ring', 'Silver Ring', 'jeweller', { silver: 1 }, 100, ['silversmithing'], 3, 48, 'a ring of bright silver.', ic('Ring', 1, 0)),
  ware('silver_chalice', 'Silver Chalice', 'jeweller', { silver: 2 }, 150, ['silversmithing'], 3, 70, 'a chalice chased with vines.', ic('Potion', 5, 0)),
  ware('sulphur_salve', 'Sulphur Salve', 'apothecary', { sulphur: 1, herbs: 2 }, 60, ['physick'], 2, 18, 'a salve for the skin.', ic('Potion', 6, 0)),
];

export const MINERAL_BUILDINGS: readonly BuildingDef[] = [
  { id: 'bell_tower', name: 'Bell Tower', layer: 'mid', width: 2, cost: { bronze: 4, stone: 12, wood: 8 }, buildSeconds: 150, purpose: 'Morale: a bronze bell rings the hours over the town.', research: 'bronze_working', morale: [4, 'The bell rings the hours'] },
];

/* ------------------------------------------------------------ trade caravans */

/** What each region's markets sell to a trade caravan (its loot odds), and what the trip costs in coins. */
const REGION_MINERALS: Record<string, { loot: Partial<Record<Material, number>>; coins: number; market: string }> = {
  heartland: { loot: { copper_ore: 4, tin_ore: 3, iron_ore: 1 }, coins: 30, market: 'the Crossroads Market' },
  westwood: { loot: { tin_ore: 4, copper_ore: 2, herbs: 1 }, coins: 40, market: 'the woodsmen’s camps' },
  northern_crags: { loot: { silver_ore: 3, copper_ore: 3, tin_ore: 2, sulphur: 1 }, coins: 60, market: 'the miners of the crags' },
  eastwood: { loot: { copper_ore: 4, sulphur: 2, tin_ore: 1 }, coins: 45, market: 'the eastern fair' },
  southern_ridges: { loot: { sulphur: 4, tin_ore: 2, silver_ore: 1 }, coins: 55, market: 'the ridge quarries' },
  southern_isle: { loot: { silver_ore: 3, copper: 2, pearls: 1 }, coins: 80, market: 'the island traders' },
  the_sea: { loot: { silver: 2, bronze: 2, pearls: 1 }, coins: 100, market: 'the wreckers’ market' },
  far_isles: { loot: { silver: 3, gems: 1, sulphur: 2 }, coins: 120, market: 'the far harbours' },
};
export const tradeId = (region: string) => `trade:${region}`;
export const isTradeDest = (id: string) => id.startsWith('trade:');
const tradeOf = (r: Region): Destination => {
  const m = REGION_MINERALS[r.id];
  const far = Math.hypot(r.x - HOME.x, r.y - HOME.y);
  return {
    id: tradeId(r.id),
    name: `Trade with ${m.market}`,
    type: 'trade',
    outSeconds: Math.round(60 + far * 0.5),
    workSeconds: 60,
    secondsPerUnit: 5,
    loot: m.loot,
    coins: m.coins,
    threats: 'Robbers on the road, now and then',
    encounters: { arrival: 0, ambush: 0.2, groups: r.foes.length ? r.foes.map((enemies) => ({ enemies, weight: 1 })) : [{ enemies: { bandit: 2 }, weight: 1 }] },
    recommendedParty: 2,
    research: 'barter',
    era: r.era,
    scenery: 'woods',
    description: `A caravan with the town's coins to ${m.market}, for the minerals the land lacks. The purse is spent when it sets out; the party brings back what it buys.`,
  };
};
/** One trade trip per region (home's from Barter; the rest once the region is mapped). */
export const TRADE_DESTINATIONS: readonly Destination[] = REGIONS.filter((r) => REGION_MINERALS[r.id]).map(tradeOf);
export const TRADE_SPOTS: Readonly<Record<string, { x: number; y: number }>> = Object.fromEntries(REGIONS.filter((r) => REGION_MINERALS[r.id]).map((r) => [tradeId(r.id), { x: r.x + (r.id === HOME_REGION ? 40 : -30), y: r.y + 30 }]));
export const TRADE_ROUTES: Readonly<Record<string, [Region['scene'], Region['scene']]>> = Object.fromEntries(REGIONS.filter((r) => REGION_MINERALS[r.id]).map((r) => [tradeId(r.id), [r.scene, r.scene]]));
export const TRADE_HIDDEN: Readonly<Record<string, string>> = Object.fromEntries(REGIONS.filter((r) => REGION_MINERALS[r.id] && r.id !== HOME_REGION).map((r) => [tradeId(r.id), r.id]));
