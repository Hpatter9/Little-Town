// Building operators (DESIGN §7): a named role for some buildings, filled by a townsperson whose skill
// sets how well the building works. Numbers are starting points for tuning.

import type { Skill } from './skills';
import { STATIONS } from './items';
import { LINES } from './stores';

export interface OperatorRole {
  title: string;
  skill: Skill;
  /** What the operator's skill does, for display. */
  effect: string;
}

/** The crafts' own titles (every other station's holder is an artisan). */
const CRAFT_TITLES: Record<string, string> = {
  campfire: 'Fire Keeper', workbench: 'Carpenter', tanning_rack: 'Tanner', drying_rack: 'Curer', kiln: 'Potter', bloomery: 'Smelter', smithy: 'Smith',
  sawmill: 'Sawyer', tannery: 'Tanner', loom: 'Weaver', windmill: 'Miller', bakery: 'Baker', steelworks: 'Steelworker', glassworks: 'Glassblower',
  gunsmith: 'Gunsmith', refinery: 'Refiner', cement_works: 'Cement Worker', electronics_plant: 'Technician', garage: 'Mechanic', alloy_foundry: 'Founder',
  chip_fab: 'Fab Engineer', battery_plant: 'Cell Maker', robot_workshop: 'Roboticist', smokehouse: 'Smoker', bone_carver: 'Bone Carver', basketry: 'Basket Weaver',
  brewery: 'Brewer', tailor: 'Tailor', jeweller: 'Jeweller', cooper: 'Cooper', apothecary: 'Apothecary', chandlery: 'Chandler', dyeworks: 'Dyer', print_shop: 'Printer',
  clockmaker: 'Clockmaker', cannery: 'Canner', textile_mill: 'Mill Hand', appliance_plant: 'Fitter', pharmacy: 'Pharmacist', bio_lab: 'Biofabricator', nanoforge: 'Nanosmith',
  blood_cellar: 'Cellarer', bone_forge: 'Bone Smith', gem_cutter: 'Gem Cutter', herb_press: 'Herbalist', pearl_works: 'Pearl Worker', felt_works: 'Felter', glamour_loom: 'Glamour Weaver',
  alembic: 'Distiller', assembler: 'Assembler', armourer: 'Armourer', pelt_house: 'Pelt Dresser', grog_pit: 'Grog-Brewer',
};

/** Town jobs: every crafting station (but the fire everyone shares), mine, the hunters' lodge and the studies have a
 *  holder picked by skill, who gets first pick of the work there (people.ts) and does it a little faster
 *  (`HOLDER_EDGE`). The fields have none: the Farm job's priorities already send the best farmers. */
const JOBS: Record<string, OperatorRole> = {};
for (const st of STATIONS) if (st !== 'tavern' && st !== 'campfire') JOBS[st] = { title: CRAFT_TITLES[st] ?? 'Artisan', skill: 'crafting', effect: 'Works the orders here first, and faster' };
for (const m of ['mine', 'coal_mine', 'deep_mine', 'oil_derrick']) JOBS[m] = { title: m === 'oil_derrick' ? 'Driller' : 'Miner', skill: 'gathering', effect: 'Digs here first, and faster' };
JOBS.hunters_lodge = { title: 'Hunter', skill: 'ranged', effect: 'Leads the hunts' };
for (const r of ['storytellers_circle', 'scriptorium', 'library', 'university', 'ai_core']) JOBS[r] = { title: 'Scholar', skill: 'research', effect: 'Studies here first, and faster' };

export const OPERATORS: Readonly<Record<string, OperatorRole>> = {
  ...JOBS,
  tavern: { title: 'Barkeep', skill: 'social', effect: 'The tavern lifts morale more; guests are talked into more' },
  fireside_inn: { title: 'Barkeep', skill: 'social', effect: 'Guests are talked into another round' },
  trading_post: { title: 'Shopkeeper', skill: 'social', effect: 'Sets out the furnishings; talks customers into more' },
  general_store: { title: 'Shopkeeper', skill: 'social', effect: 'Sets out the furnishings; talks customers into more' },
  emporium: { title: 'Shopkeeper', skill: 'social', effect: 'Sets out the furnishings; talks customers into more' },
  ...Object.fromEntries(Object.values(LINES).map((l) => [l.store, { title: l.keeper, skill: 'social' as Skill, effect: 'Sets out the shelves and racks; talks customers into more' }])),
  market: { title: 'Merchant', skill: 'social', effect: 'Better prices from caravans' },
  infirmary: { title: 'Healer', skill: 'medicine', effect: 'Wounds heal faster still' },
  watchtower: { title: 'Guard Captain', skill: 'melee', effect: 'Defenders hit harder and more often' },
};

/** How much faster a job's holder works at their own station. */
export const HOLDER_EDGE = 1.15;

/** Tavern morale: base, plus this per Barkeep Social level. */
export const TAVERN_BASE = 4;
export const TAVERN_PER_LEVEL = 0.6;
/** Merchant: caravan prices improve by this per Social level (on both buying and selling). */
export const MERCHANT_PER_LEVEL = 0.02;
/** Healer: extra healing per Medicine level (on top of the infirmary's). */
export const HEALER_PER_LEVEL = 0.1;
/** Guard Captain: defenders' accuracy per level of the captain's best fighting skill. */
export const CAPTAIN_PER_LEVEL = 0.01;
