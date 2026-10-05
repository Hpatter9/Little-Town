// The armoury: about a hundred and fifty weapons in twenty-odd families, era by era, on top of the first few in
// items.ts. Each family fights its own way (a dagger is quick and finds the gaps, an axe cleaves into the next foe, a
// mace stuns and crushes armour, a spear keeps foes at its point, a crossbow punches through plate, a staff's fire
// bursts...), and within a family the tier sets how hard it hits: each tier about a quarter more than the last, so a
// crafted +5 (quality.ts) is worth about three tiers. Stats, costs and stations are worked out from the family, the
// tier and the era; the rows below are only names, research and icons.

import type { Era } from './eras';
import type { IconSheet, ItemDef, ItemEffects, Station } from './items';
import type { Material } from './materials';

/** A family of weapons: how it hits (its share of the tier's damage, its aim) and its quirks (see ItemEffects). */
interface Family {
  name: string;
  dmg: number;
  acc: number;
  fx?: Partial<ItemEffects>;
  /** Fights from range; what it shoots, by era (none: it's thrown, or it's magic). */
  ranged?: boolean;
  ammo?: Partial<Record<Era, Material>>;
  /** How far it reaches on the raid's battle map (cells): a dagger only what's at arm's length, a spear or a polearm
   *  a step further for a melee weapon, a bow or a long gun far down the trail. */
  range: number;
  /** What it's made of: a blade or head, a haft, a string or grip, a gun's works, a mage's focus. */
  parts: 'blade' | 'heavy' | 'haft' | 'bow' | 'crossbow' | 'sling' | 'thrown' | 'gun' | 'energy' | 'magic';
}

export type FamilyId = 'dg' | 'sw' | 'ax' | 'mc' | 'sp' | 'pl' | 'gs' | 'fl' | 'sc' | 'cl' | 'sl' | 'th' | 'bw' | 'lb' | 'cb' | 'st' | 'wd' | 'pi' | 'lg' | 'sg' | 'ag' | 'en' | 'hv';

const ARROWS: Partial<Record<Era, Material>> = { medieval: 'arrows', industrial: 'arrows', modern: 'arrows', space: 'power_cells' };
const ROUNDS: Partial<Record<Era, Material>> = { industrial: 'shot', modern: 'cartridges', space: 'power_cells' };

export const FAMILIES: Record<FamilyId, Family> = {
  dg: { name: 'Dagger', range: 1, dmg: 0.65, acc: 0.08, fx: { speed: 0.75, crit: 0.15 }, parts: 'blade' },
  sw: { name: 'Sword', range: 1.2, dmg: 1, acc: 0.1, fx: { crit: 0.05 }, parts: 'blade' },
  ax: { name: 'Axe', range: 1.2, dmg: 1.15, acc: 0, fx: { cleave: 0.4 }, parts: 'heavy' },
  mc: { name: 'Mace', range: 1.2, dmg: 1.05, acc: -0.02, fx: { stun: 0.12, pierce: 0.3 }, parts: 'heavy' },
  sp: { name: 'Spear', range: 2.2, dmg: 0.95, acc: 0.05, fx: { reach: true }, parts: 'haft' },
  pl: { name: 'Polearm', range: 2.6, dmg: 1.2, acc: 0, fx: { reach: true, cleave: 0.25, speed: 1.15 }, parts: 'haft' },
  gs: { name: 'Great Weapon', range: 1.5, dmg: 1.5, acc: -0.03, fx: { speed: 1.3, cleave: 0.3 }, parts: 'heavy' },
  fl: { name: 'Flail', range: 1.5, dmg: 0.95, acc: -0.04, fx: { stun: 0.2 }, parts: 'heavy' },
  sc: { name: 'Scythe', range: 1.6, dmg: 1.05, acc: 0, fx: { crit: 0.1, cleave: 0.2 }, parts: 'haft' },
  cl: { name: 'Claws', range: 1, dmg: 0.7, acc: 0.05, fx: { speed: 0.7, crit: 0.08 }, parts: 'blade' },
  sl: { name: 'Sling', range: 3.5, dmg: 0.6, acc: 0, ranged: true, ammo: { neolithic: 'sling_stones', medieval: 'sling_stones' }, parts: 'sling' },
  th: { name: 'Thrown', range: 3, dmg: 0.85, acc: 0, fx: { speed: 0.9 }, ranged: true, parts: 'thrown' },
  bw: { name: 'Bow', range: 4.5, dmg: 0.8, acc: 0.03, ranged: true, ammo: ARROWS, parts: 'bow' },
  lb: { name: 'Longbow', range: 6, dmg: 1, acc: 0.07, fx: { speed: 1.15 }, ranged: true, ammo: ARROWS, parts: 'bow' },
  cb: { name: 'Crossbow', range: 5, dmg: 1.2, acc: 0.05, fx: { speed: 1.35, pierce: 0.4 }, ranged: true, ammo: ARROWS, parts: 'crossbow' },
  st: { name: 'Staff', range: 4, dmg: 0.9, acc: 0.05, fx: { cleave: 0.35 }, ranged: true, parts: 'magic' },
  wd: { name: 'Wand', range: 3.5, dmg: 0.65, acc: 0.1, fx: { speed: 0.8 }, ranged: true, parts: 'magic' },
  pi: { name: 'Pistol', range: 3.5, dmg: 0.9, acc: 0.03, fx: { speed: 0.9 }, ranged: true, ammo: ROUNDS, parts: 'gun' },
  lg: { name: 'Long Gun', range: 6.5, dmg: 1.3, acc: 0.08, fx: { speed: 1.2, crit: 0.08 }, ranged: true, ammo: ROUNDS, parts: 'gun' },
  sg: { name: 'Shotgun', range: 2.8, dmg: 1.15, acc: -0.05, fx: { cleave: 0.5 }, ranged: true, ammo: ROUNDS, parts: 'gun' },
  ag: { name: 'Automatic', range: 5, dmg: 0.7, acc: -0.02, fx: { speed: 0.6 }, ranged: true, ammo: ROUNDS, parts: 'gun' },
  en: { name: 'Energy Weapon', range: 6, dmg: 1, acc: 0.1, fx: { pierce: 0.2 }, ranged: true, ammo: { space: 'power_cells' }, parts: 'energy' },
  hv: { name: 'Heavy Weapon', range: 6.5, dmg: 1.45, acc: 0, fx: { speed: 1.3, cleave: 0.4, pierce: 0.3 }, ranged: true, ammo: ROUNDS, parts: 'energy' },
};

/** Damage of a tier (1 to 10): each about 28% more than the last, 2 at the first, 18 at the tenth. */
export const tierDamage = (tier: number) => 2 * 1.28 ** (tier - 1);

type Icon = [IconSheet, number, number] | ['Custom', string];
/** A row: id, name, family, tier, era, research, icon, and any extra effects (banes, a stunning bolas...). */
type Row = [string, string, FamilyId, number, Era, string[], Icon, Partial<ItemEffects>?];

const SW = (x: number, y: number): Icon => ['ShortWep', x, y];
const MW = (x: number, y: number): Icon => ['MedWep', x, y];
const LW = (x: number, y: number): Icon => ['LongWep', x, y];
const AM = (x: number, y: number): Icon => ['Ammo', x, y];
const WD = (x: number, y: number): Icon => ['Wand', x, y];
const C = (name: string): Icon => ['Custom', name];
const N: Era = 'neolithic';
const M: Era = 'medieval';
const I: Era = 'industrial';
const O: Era = 'modern';
const S: Era = 'space';

const ROWS: Row[] = [
  // Stone Age
  ['bone_knife', 'Bone Knife', 'dg', 1, N, ['flint_knapping'], SW(2, 1)],
  ['flint_dagger', 'Flint Dagger', 'dg', 2, N, ['flint_knapping'], SW(4, 0)],
  ['obsidian_knife', 'Obsidian Knife', 'dg', 3, N, ['stoneworking'], SW(1, 0)],
  ['fire_club', 'Fire-Hardened Club', 'mc', 2, N, ['fire_keeping'], SW(1, 2)],
  ['stone_club', 'Stone-Headed Club', 'mc', 3, N, ['stoneworking'], SW(0, 2)],
  ['bone_mace', 'Bone Mace', 'mc', 4, N, ['tanning'], SW(0, 4)],
  ['antler_pick', 'Antler Pick', 'mc', 3, N, ['stoneworking'], SW(0, 3)],
  ['stone_hatchet', 'Stone Hatchet', 'ax', 2, N, ['woodcutting'], MW(0, 1)],
  ['flint_war_axe', 'Flint War Axe', 'ax', 3, N, ['flint_knapping', 'woodcutting'], MW(1, 1)],
  ['bone_harpoon', 'Bone Harpoon', 'sp', 3, N, ['spear_hunting'], LW(6, 0), { beastDamage: 3 }],
  ['hunting_spear', 'Hunting Spear', 'sp', 4, N, ['spear_hunting', 'tanning'], LW(4, 4), { beastDamage: 2 }],
  ['flint_glaive', 'Flint Glaive', 'pl', 4, N, ['spear_hunting', 'stoneworking'], LW(2, 2)],
  ['stone_maul', 'Stone Maul', 'gs', 4, N, ['stoneworking'], LW(0, 6)],
  ['flint_sickle', 'Flint Sickle', 'sc', 2, N, ['early_agriculture'], SW(2, 0)],
  ['bone_claws', 'Bone Claws', 'cl', 2, N, ['tanning'], SW(3, 0)],
  ['throwing_stick', 'Throwing Stick', 'th', 1, N, ['woodcutting'], AM(2, 3)],
  ['flint_javelins', 'Flint Javelins', 'th', 2, N, ['spear_hunting'], AM(5, 2)],
  ['atlatl', 'Atlatl and Darts', 'th', 3, N, ['spear_hunting', 'cordage'], AM(0, 3)],
  ['bolas', 'Bolas', 'th', 2, N, ['cordage'], AM(5, 1), { stun: 0.3 }],
  ['hide_sling', 'Hide Sling', 'sl', 2, N, ['tanning', 'cordage'], AM(4, 1)],
  ['hunting_bow', 'Hunting Bow', 'bw', 3, N, ['cordage', 'spear_hunting'], AM(2, 1), { beastDamage: 2 }],
  ['shaman_staff', "Shaman's Staff", 'st', 2, N, ['herbalism'], WD(1, 0)],
  ['bone_wand', 'Bone Wand', 'wd', 2, N, ['herbalism'], WD(5, 5)],
  ['spiked_club', 'Spiked Club', 'mc', 3, N, ['woodcutting', 'flint_knapping'], SW(0, 2), { crit: 0.05 }],

  // Medieval
  ['iron_dagger', 'Iron Dagger', 'dg', 4, M, ['iron_working'], SW(0, 0)],
  ['stiletto', 'Stiletto', 'dg', 5, M, ['guilds'], SW(5, 0), { pierce: 0.3 }],
  ['rondel_dagger', 'Rondel Dagger', 'dg', 6, M, ['armoring'], SW(7, 0)],
  ['short_sword', 'Short Sword', 'sw', 5, M, ['iron_working'], SW(0, 1)],
  ['arming_sword', 'Arming Sword', 'sw', 6, M, ['armoring'], MW(0, 0)],
  ['falchion', 'Falchion', 'sw', 6, M, ['guilds'], MW(1, 0)],
  ['scimitar', 'Scimitar', 'sw', 6, M, ['trade'], SW(3, 0)],
  ['estoc', 'Estoc', 'sw', 7, M, ['fortification'], SW(1, 1), { pierce: 0.3 }],
  ['longsword', 'Longsword', 'sw', 7, M, ['armoring', 'guilds'], MW(3, 0)],
  ['silver_sword', 'Silver Sword', 'sw', 6, M, ['trade', 'writing'], MW(5, 0), { undeadDamage: 6 }],
  ['bastard_sword', 'Bastard Sword', 'gs', 7, M, ['fortification'], LW(2, 1)],
  ['claymore', 'Claymore', 'gs', 8, M, ['fortification', 'guilds'], LW(0, 1)],
  ['hand_axe', 'Hand Axe', 'ax', 4, M, ['iron_working'], MW(0, 1)],
  ['bearded_axe', 'Bearded Axe', 'ax', 5, M, ['carpentry'], MW(1, 1)],
  ['battle_axe', 'Battle Axe', 'ax', 6, M, ['armoring'], LW(0, 4)],
  ['great_axe', 'Great Axe', 'ax', 7, M, ['fortification'], LW(1, 4)],
  ['iron_mace', 'Iron Mace', 'mc', 5, M, ['iron_working'], SW(0, 4)],
  ['morning_star', 'Morning Star', 'mc', 6, M, ['armoring'], SW(1, 4)],
  ['war_pick', 'War Pick', 'mc', 6, M, ['mining'], SW(1, 3), { pierce: 0.5 }],
  ['war_hammer', 'War Hammer', 'mc', 7, M, ['fortification'], SW(2, 3)],
  ['blessed_mace', 'Blessed Mace', 'mc', 6, M, ['writing'], SW(1, 4), { undeadDamage: 6 }],
  ['quarterstaff', 'Quarterstaff', 'mc', 4, M, ['carpentry'], LW(2, 4), { speed: 0.9 }],
  ['flail', 'Flail', 'fl', 5, M, ['leatherworking'], SW(2, 4)],
  ['chain_flail', 'Chain Flail', 'fl', 6, M, ['armoring'], SW(2, 2)],
  ['bullwhip', 'Bullwhip', 'fl', 4, M, ['leatherworking'], LW(1, 5)],
  ['iron_spear', 'Iron Spear', 'sp', 5, M, ['iron_working'], LW(4, 4)],
  ['boar_spear', 'Boar Spear', 'sp', 6, M, ['animal_husbandry'], LW(4, 4), { beastDamage: 5 }],
  ['pike', 'Pike', 'pl', 6, M, ['fortification'], LW(3, 2)],
  ['billhook', 'Billhook', 'pl', 5, M, ['carpentry'], LW(2, 3)],
  ['glaive', 'Glaive', 'pl', 6, M, ['guilds'], LW(0, 3)],
  ['halberd', 'Halberd', 'pl', 7, M, ['fortification', 'armoring'], LW(3, 3)],
  ['lance', 'Lance', 'pl', 7, M, ['carts'], LW(1, 6)],
  ['sickle', 'Iron Sickle', 'sc', 4, M, ['crop_rotation'], LW(0, 0)],
  ['war_scythe', 'War Scythe', 'sc', 6, M, ['milling'], LW(3, 4)],
  ['iron_knuckles', 'Iron Knuckles', 'cl', 4, M, ['iron_working'], SW(2, 1)],
  ['tiger_claws', 'Tiger Claws', 'cl', 6, M, ['guilds'], SW(3, 1)],
  ['staff_sling', 'Staff Sling', 'sl', 4, M, ['carpentry'], AM(5, 1)],
  ['iron_javelins', 'Iron Javelins', 'th', 5, M, ['iron_working'], AM(5, 2)],
  ['throwing_stars', 'Throwing Stars', 'th', 5, M, ['guilds'], AM(1, 3), { crit: 0.12 }],
  ['throwing_knives', 'Throwing Knives', 'th', 6, M, ['guilds', 'iron_working'], AM(0, 3)],
  ['hunters_bow', "Hunter's Bow", 'bw', 4, M, ['archery'], AM(0, 1), { beastDamage: 3 }],
  ['recurve_bow', 'Recurve Bow', 'bw', 5, M, ['archery', 'leatherworking'], AM(2, 1)],
  ['composite_bow', 'Composite Bow', 'bw', 7, M, ['archery', 'guilds'], AM(3, 1)],
  ['longbow', 'Longbow', 'lb', 6, M, ['archery'], AM(1, 1)],
  ['great_bow', 'Great Bow', 'lb', 7, M, ['archery', 'fortification'], AM(0, 1)],
  ['light_crossbow', 'Light Crossbow', 'cb', 5, M, ['archery', 'carpentry'], AM(0, 4)],
  ['heavy_crossbow', 'Heavy Crossbow', 'cb', 6, M, ['archery', 'armoring'], AM(1, 4)],
  ['arbalest', 'Arbalest', 'cb', 7, M, ['fortification', 'archery'], AM(1, 4)],
  ['oak_staff', 'Oak Staff', 'st', 4, M, ['arcane_arts'], WD(1, 1)],
  ['rune_staff', 'Rune Staff', 'st', 6, M, ['arcane_arts', 'writing'], WD(1, 2)],
  ['crystal_staff', 'Crystal Staff', 'st', 7, M, ['arcane_arts', 'mining'], WD(3, 2)],
  ['ember_wand', 'Ember Wand', 'wd', 5, M, ['arcane_arts'], WD(3, 0)],
  ['frost_wand', 'Frost Wand', 'wd', 5, M, ['arcane_arts'], WD(0, 0), { stun: 0.15 }],
  ['storm_wand', 'Storm Wand', 'wd', 6, M, ['arcane_arts', 'writing'], WD(4, 0)],
  ['sai', 'Sai', 'dg', 6, M, ['guilds', 'armoring'], SW(3, 1), { stun: 0.1 }],
  ['partisan', 'Partisan', 'pl', 6, M, ['armoring'], LW(2, 2)],
  ['trident', 'Trident', 'sp', 6, M, ['trade'], LW(6, 0), { cleave: 0.15 }],
  ['grave_wand', 'Grave Wand', 'wd', 6, M, ['necromancy'], WD(3, 3), { undeadDamage: 5 }],

  // Industrial
  ['steel_dagger', 'Steel Dagger', 'dg', 6, I, ['steelmaking'], SW(6, 0)],
  ['cavalry_sabre', 'Cavalry Sabre', 'sw', 7, I, ['steelmaking'], MW(2, 0)],
  ['rapier', 'Rapier', 'sw', 7, I, ['steelmaking', 'public_library'], SW(5, 0), { crit: 0.12, speed: 0.9 }],
  ['cutlass', 'Cutlass', 'sw', 7, I, ['steelmaking', 'railways'], SW(0, 1)],
  ['cane_sword', 'Sword Cane', 'sw', 6, I, ['public_library'], SW(1, 1)],
  ['machete', 'Machete', 'sw', 6, I, ['industrial_farming'], MW(1, 0), { cleave: 0.15 }],
  ['steel_war_axe', 'Steel War Axe', 'ax', 8, I, ['steelmaking'], LW(1, 4)],
  ['sledgehammer', 'Sledgehammer', 'mc', 8, I, ['steam_power'], LW(0, 6)],
  ['shock_baton', 'Shock Baton', 'mc', 7, I, ['electricity'], SW(1, 2), { stun: 0.25 }],
  ['steel_halberd', 'Steel Halberd', 'pl', 8, I, ['steelmaking', 'railways'], LW(3, 3)],
  ['harpoon_gun', 'Whaling Harpoon', 'sp', 7, I, ['steam_power'], LW(6, 0), { beastDamage: 6 }],
  ['zweihander', 'Zweihander', 'gs', 8, I, ['steelmaking'], LW(4, 1)],
  ['brass_knuckles', 'Brass Knuckles', 'cl', 6, I, ['coal_mining'], SW(2, 1)],
  ['repeating_crossbow', 'Repeating Crossbow', 'cb', 7, I, ['steam_power'], AM(0, 4), { speed: 0.9 }],
  ['flintlock_pistol', 'Flintlock Pistol', 'pi', 6, I, ['firearms'], C('pistol')],
  ['duelling_pistol', 'Duelling Pistol', 'pi', 7, I, ['firearms', 'public_library'], C('pistol'), { crit: 0.1 }],
  ['blunderbuss', 'Blunderbuss', 'sg', 7, I, ['firearms'], C('shotgun')],
  ['carbine', 'Carbine', 'lg', 7, I, ['firearms', 'railways'], C('musket')],
  ['long_rifle', 'Long Rifle', 'lg', 8, I, ['firearms', 'steelmaking'], C('rifle')],
  ['lever_rifle', 'Lever-Action Rifle', 'lg', 8, I, ['firearms', 'assembly_lines'], C('rifle'), { speed: 1.05 }],
  ['crank_gun', 'Hand-Crank Gun', 'ag', 8, I, ['assembly_lines', 'firearms'], C('gatling')],
  ['fire_bombs', 'Fire Bombs', 'th', 8, I, ['glassblowing'], C('bomb'), { cleave: 0.6 }],
  ['lightning_rod', 'Lightning Rod Staff', 'st', 8, I, ['electricity', 'arcane_arts'], WD(4, 1), { stun: 0.15 }],

  // Modern
  ['combat_knife', 'Combat Knife', 'dg', 7, O, ['refining'], SW(7, 0)],
  ['katana', 'Katana', 'sw', 8, O, ['containerization'], MW(4, 0), { crit: 0.15 }],
  ['tomahawk', 'Tomahawk', 'ax', 8, O, ['refining'], MW(0, 1), { speed: 0.9 }],
  ['riot_baton', 'Riot Baton', 'mc', 8, O, ['concrete'], SW(1, 2), { stun: 0.2 }],
  ['aluminium_bat', 'Aluminium Bat', 'mc', 7, O, ['radio'], SW(0, 2)],
  ['stun_gun', 'Stun Gun', 'pi', 7, O, ['electronics'], C('laser_pistol'), { stun: 0.35 }],
  ['revolver', 'Revolver', 'pi', 8, O, ['rifles'], C('revolver')],
  ['semi_auto_pistol', 'Semi-Auto Pistol', 'pi', 8, O, ['rifles', 'electronics'], C('pistol'), { speed: 0.8 }],
  ['pump_shotgun', 'Pump Shotgun', 'sg', 8, O, ['rifles'], C('shotgun')],
  ['combat_shotgun', 'Combat Shotgun', 'sg', 9, O, ['rifles', 'refining'], C('shotgun')],
  ['nail_gun', 'Nail Gun', 'ag', 7, O, ['electronics'], C('smg')],
  ['submachine_gun', 'Submachine Gun', 'ag', 8, O, ['rifles', 'electronics'], C('smg')],
  ['assault_rifle', 'Assault Rifle', 'ag', 9, O, ['rifles', 'refining'], C('rifle')],
  ['hunting_rifle', 'Hunting Rifle', 'lg', 8, O, ['rifles'], C('rifle'), { beastDamage: 8 }],
  ['sniper_rifle', 'Sniper Rifle', 'lg', 9, O, ['rifles', 'higher_education'], C('rifle'), { crit: 0.2 }],
  ['compound_bow', 'Compound Bow', 'bw', 8, O, ['refining'], AM(3, 1)],
  ['carbon_crossbow', 'Carbon Crossbow', 'cb', 8, O, ['refining', 'electronics'], AM(1, 4)],
  ['flamethrower', 'Flamethrower', 'sg', 9, O, ['refining', 'motor_transport'], C('flamer'), { cleave: 0.7, undeadDamage: 6 }],
  ['grenade_launcher', 'Grenade Launcher', 'hv', 9, O, ['rifles', 'motor_transport'], C('bomb')],

  // Robotic & Space
  ['vibro_knife', 'Vibro-Knife', 'dg', 9, S, ['advanced_alloys'], SW(4, 0)],
  ['chainsword', 'Chainsword', 'sw', 9, S, ['robotics'], MW(4, 0), { cleave: 0.2 }],
  ['monoblade', 'Monomolecular Blade', 'sw', 10, S, ['advanced_alloys', 'microchips'], MW(5, 0), { pierce: 0.6 }],
  ['nanite_greatblade', 'Nanite Greatblade', 'gs', 10, S, ['robotics', 'advanced_alloys'], LW(1, 1)],
  ['plasma_axe', 'Plasma Axe', 'ax', 10, S, ['fusion'], LW(1, 4)],
  ['gravity_hammer', 'Gravity Hammer', 'mc', 10, S, ['fusion', 'advanced_alloys'], LW(0, 6), { cleave: 0.4 }],
  ['shock_lance', 'Shock Lance', 'pl', 9, S, ['power_storage'], LW(1, 6), { stun: 0.2 }],
  ['energy_glaive', 'Energy Glaive', 'pl', 10, S, ['energy_weapons', 'advanced_alloys'], LW(0, 3)],
  ['power_fist', 'Power Fist', 'cl', 9, S, ['robotics'], SW(2, 1), { stun: 0.2 }],
  ['laser_pistol', 'Laser Pistol', 'en', 9, S, ['energy_weapons'], C('laser_pistol'), { speed: 0.85 }],
  ['plasma_pistol', 'Plasma Pistol', 'en', 10, S, ['fusion'], C('laser_pistol'), { cleave: 0.2 }],
  ['laser_carbine', 'Laser Carbine', 'en', 9, S, ['energy_weapons', 'power_storage'], C('laser_rifle')],
  ['pulse_smg', 'Pulse SMG', 'ag', 9, S, ['microchips', 'energy_weapons'], C('smg')],
  ['smart_rifle', 'Smart Rifle', 'lg', 10, S, ['artificial_intelligence'], C('rifle'), { accuracy: 0.15 }],
  ['plasma_rifle', 'Plasma Rifle', 'hv', 10, S, ['fusion', 'energy_weapons'], C('plasma_rifle')],
  ['railgun', 'Railgun', 'hv', 10, S, ['fusion', 'advanced_alloys'], C('railgun'), { pierce: 0.8 }],
  ['arc_caster', 'Arc Caster', 'sg', 10, S, ['energy_shields'], C('plasma_rifle'), { stun: 0.25, machineDamage: 8 }],
  ['photon_bow', 'Photon Bow', 'bw', 10, S, ['energy_weapons'], AM(1, 1)],
  ['disc_launcher', 'Disc Launcher', 'th', 9, S, ['robotics'], AM(1, 3)],
  ['ion_wand', 'Ion Wand', 'wd', 9, S, ['microchips', 'arcane_arts'], WD(4, 3), { machineDamage: 8 }],
  ['quantum_staff', 'Quantum Staff', 'st', 10, S, ['fusion', 'arcane_arts'], WD(0, 6)],
  ['singularity_charge', 'Singularity Charges', 'th', 10, S, ['fusion'], C('bomb'), { cleave: 0.8 }],
];

/** What each kind of part is made of, by era. */
const METAL: Record<Era, Material> = { neolithic: 'flint', medieval: 'iron', industrial: 'steel', modern: 'steel', space: 'alloys' };
const HAFT: Record<Era, Material> = { neolithic: 'wood', medieval: 'lumber', industrial: 'lumber', modern: 'plastic', space: 'alloys' };
const GRIP: Record<Era, Material> = { neolithic: 'hide', medieval: 'leather', industrial: 'leather', modern: 'plastic', space: 'circuits' };
const STRING: Record<Era, Material> = { neolithic: 'fiber', medieval: 'fiber', industrial: 'cloth', modern: 'plastic', space: 'circuits' };
const FOCUS: Record<Era, Material> = { neolithic: 'bone', medieval: 'herbs', industrial: 'glass', modern: 'electronics', space: 'rare_minerals' };
const WORKS: Record<Era, Material> = { neolithic: 'stone', medieval: 'iron', industrial: 'coal', modern: 'electronics', space: 'circuits' };

function costOf(f: Family, tier: number, era: Era): Partial<Record<Material, number>> {
  const n = Math.max(1, Math.round(1 + tier / 2.5));
  const c: Partial<Record<Material, number>> = {};
  const add = (m: Material, k: number) => (c[m] = (c[m] ?? 0) + Math.max(1, k));
  switch (f.parts) {
    case 'blade':
      add(METAL[era], n);
      add(GRIP[era], 1);
      break;
    case 'heavy':
      add(era === 'neolithic' ? 'stone' : METAL[era], n + 1);
      add(HAFT[era], 1);
      break;
    case 'haft':
      add(METAL[era], Math.ceil(n / 2));
      add(HAFT[era], n);
      break;
    case 'bow':
      add(HAFT[era], n);
      add(STRING[era], Math.ceil(n / 2));
      break;
    case 'crossbow':
      add(HAFT[era], n);
      add(era === 'neolithic' ? 'flint' : METAL[era], Math.ceil(n / 2));
      add(STRING[era], 1);
      break;
    case 'sling':
      add(GRIP[era], 1);
      add('fiber', n);
      break;
    case 'thrown':
      add(era === 'neolithic' ? 'flint' : METAL[era], n);
      add(HAFT[era], 1);
      break;
    case 'gun':
      add(METAL[era], n);
      add(HAFT[era], Math.ceil(n / 2));
      add(WORKS[era], 1);
      break;
    case 'energy':
      add(METAL[era], n);
      add(WORKS[era], n);
      break;
    case 'magic':
      add(HAFT[era], Math.ceil(n / 2));
      add(FOCUS[era], n);
      break;
  }
  return c;
}

function stationOf(f: Family, era: Era): Station {
  const metal = f.parts === 'blade' || f.parts === 'heavy' || f.parts === 'haft' || f.parts === 'thrown';
  switch (era) {
    case 'neolithic':
      return f.parts === 'heavy' || f.parts === 'thrown' ? 'campfire' : 'workbench';
    case 'medieval':
      return metal || f.parts === 'crossbow' ? 'smithy' : 'workbench';
    case 'industrial':
      return f.parts === 'gun' ? 'gunsmith' : metal ? 'smithy' : 'workbench';
    case 'modern':
      return f.parts === 'gun' || f.parts === 'energy' ? 'gunsmith' : f.parts === 'magic' ? 'electronics_plant' : metal ? 'smithy' : 'workbench';
    case 'space':
      return f.parts === 'gun' || f.parts === 'energy' || f.parts === 'magic' ? 'chip_fab' : 'alloy_foundry';
  }
}

/** Words for a weapon's quirks, for its description. */
export function quirkWords(fx: ItemEffects): string[] {
  const out: string[] = [];
  if (fx.speed !== undefined && fx.speed < 0.95) out.push('quick');
  if (fx.speed !== undefined && fx.speed > 1.05) out.push('slow');
  if (fx.crit) out.push(`${Math.round(fx.crit * 100)}% to strike true for double`);
  if (fx.pierce) out.push(`pierces ${Math.round(fx.pierce * 100)}% of armour`);
  if (fx.cleave) out.push(`cleaves ${Math.round(fx.cleave * 100)}% into the next foe`);
  if (fx.stun) out.push(`${Math.round(fx.stun * 100)}% to stun`);
  if (fx.reach) out.push('keeps foes at its point');
  if (fx.beastDamage) out.push(`+${fx.beastDamage} against beasts`);
  if (fx.undeadDamage) out.push(`+${fx.undeadDamage} against the dead`);
  if (fx.machineDamage) out.push(`+${fx.machineDamage} against machines`);
  if (fx.lifesteal) out.push(`drinks ${Math.round(fx.lifesteal * 100)}% of its blows as life`);
  return out;
}

export const WEAPONS: readonly ItemDef[] = ROWS.map(([id, name, fam, tier, era, research, icon, extra]) => {
  const f = FAMILIES[fam];
  const effects: ItemEffects = {
    damage: Math.max(1, Math.round(tierDamage(tier) * f.dmg)),
    ...(f.acc ? { accuracy: f.acc } : {}),
    ...(f.ranged ? { ranged: true } : {}),
    ...(f.ammo?.[era] ? { ammo: f.ammo[era] } : {}),
    range: f.range,
    ...f.fx,
    ...extra,
  };
  const words = quirkWords(effects);
  return {
    id,
    name,
    slot: 'weapon',
    station: stationOf(f, era),
    cost: costOf(f, tier, era),
    seconds: 30 + tier * 12,
    research,
    effects,
    family: fam,
    tier,
    description: `${f.name}, tier ${tier}: +${effects.damage} ${f.ranged ? 'ranged' : 'melee'} damage, range ${f.range}${words.length ? `; ${words.join(', ')}` : ''}.`,
    icon: icon[0] === 'Custom' ? { sheet: 'Custom', x: 0, y: 0, name: icon[1] as string } : { sheet: icon[0], x: icon[1] as number, y: icon[2] as number },
  };
});
