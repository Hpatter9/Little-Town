// Unique weapons: named, one of each in the world, never made or sold. Each boss has a loot table (`BOSS_LOOT`): its
// trophy (enemies.ts, always), a chance at one of its uniques it hasn't given up yet, and a purse of coins. A few uniques
// come from no boss: they're held back for quests. A unique hits about a third harder than a made weapon of its tier and
// family, with the family's quirks and its own on top (some drink the life of what they strike: `lifesteal`).

import type { Era } from './eras';
import type { ItemDef, ItemEffects } from './items';
import { FAMILIES, quirkWords, tierDamage, WEAPONS, type FamilyId } from './weapons';

/** A unique's row: id, name, family, tier, era (for its ammo), its own quirks, a line of lore, and the bosses that drop it
 *  (none: a quest's). */
type Row = [string, string, FamilyId, number, Era, Partial<ItemEffects>, string, string[]];

const N: Era = 'neolithic';
const M: Era = 'medieval';
const I: Era = 'industrial';
const O: Era = 'modern';
const S: Era = 'space';

const ROWS: Row[] = [
  // the beasts and the wild
  ['tuskrender', 'Tuskrender', 'ax', 4, N, { beastDamage: 6 }, 'Hewn from the Boar King\'s own tusk.', ['boar_king']],
  ['ursine_claws', 'Ursine Claws', 'cl', 3, N, { beastDamage: 4, lifesteal: 0.08 }, 'The Cave Bear\'s claws, bound to a fist.', ['cave_bear']],
  ['mossback_club', 'Mossback', 'mc', 3, N, { stun: 0.25 }, 'A stump of a club, still growing moss.', ['mossback']],
  ['thornlash', 'Thornlash', 'fl', 5, N, { stun: 0.2, lifesteal: 0.08 }, 'A briar that bites and drinks.', ['thornmaw']],
  ['earthshaker', 'Earthshaker', 'mc', 8, M, { stun: 0.35, beastDamage: 6 }, 'Carved from the Behemoth\'s knee. The ground jumps when it falls.', ['behemoth']],
  ['moonfang', 'Moonfang', 'cl', 6, M, { lifesteal: 0.12, crit: 0.1 }, 'The Alpha\'s fang, white as the moon that turned him.', ['the_alpha']],
  ['heartwood_bow', 'Heartwood', 'lb', 6, M, { beastDamage: 8 }, 'Grown, not made: the Archdruid\'s bow still flowers in spring.', ['archdruid']],
  ['wild_hunt_spear', 'The Hunt\'s Spear', 'th', 6, M, { crit: 0.15, beastDamage: 5 }, 'Thrown, it always comes back to the hand.', ['hunt_queen']],
  ['plaguefang', 'Plaguefang', 'dg', 7, M, { lifesteal: 0.1, beastDamage: 6 }, 'The Rat King\'s tooth, sharp and filthy.', ['rat_king']],
  // the old world's lords and monsters
  ['bone_rattle', 'The Bone Rattle', 'wd', 4, N, { undeadDamage: 6, lifesteal: 0.08 }, 'The Shaman King\'s rattle of knuckle-bones.', ['shaman_king']],
  ['gilded_scepter', 'The Gilded Scepter', 'mc', 5, M, { crit: 0.15 }, 'Solid gold, and the idol\'s eyes still watch from its head.', ['gilded_idol']],
  ['labyrinth_breaker', 'Labyrinth-Breaker', 'gs', 7, M, { cleave: 0.6 }, 'Asterion\'s double axe. It went through walls to find him.', ['minotaur_lord']],
  ['stonegaze', 'Stonegaze', 'lb', 7, M, { stun: 0.3 }, 'Strung with the Gorgon Queen\'s hair. Its arrows stiffen what they strike.', ['gorgon_queen']],
  ['masterless', 'Masterless', 'sw', 7, M, { crit: 0.25, speed: 0.85 }, 'Kagemaru\'s katana. It has served no lord, and serves you only as long as it likes.', ['ronin_warlord']],
  ['foxfire', 'Foxfire', 'wd', 7, M, { pierce: 0.5, crit: 0.1 }, 'A wand of nine-tailed flame that burns past any armour.', ['kitsune']],
  ['hellbrand', 'Hellbrand', 'gs', 9, M, { lifesteal: 0.15, cleave: 0.4 }, 'Azgoroth\'s sword. It never cools.', ['devil_lord']],
  ['infernal_arbalest', 'The Infernal Arbalest', 'cb', 8, M, { pierce: 0.7 }, 'Its bolts are coals from the pit.', ['devil_lord']],
  ['oathbreaker', 'Oathbreaker', 'sw', 7, M, { crit: 0.12, lifesteal: 0.06 }, 'The Black Knight swore on it, and broke every vow.', ['black_knight']],
  ['dragonfang', 'Dragonfang', 'sp', 9, M, { beastDamage: 10, pierce: 0.4 }, 'A spear tipped with one of Vermithrax\'s teeth.', ['dragon']],
  ['wyrmfire', 'Wyrmfire', 'st', 9, M, { cleave: 0.6 }, 'A staff with the dragon\'s last breath trapped in its crystal.', ['dragon']],
  ['warlords_glaive', 'The Warlord\'s Glaive', 'pl', 8, M, { cleave: 0.45, crit: 0.08 }, 'Long enough to clear a wall of shields.', ['warlord']],
  ['winters_edge', 'Winter\'s Edge', 'sw', 8, M, { stun: 0.2, crit: 0.1 }, 'Frost forms along it in summer.', ['frost_archmage']],
  ['stitched_cleaver', 'The Stitched Cleaver', 'ax', 8, I, { cleave: 0.6, lifesteal: 0.08 }, 'The Abomination\'s own arm, more or less.', ['abomination']],
  ['soulreaper', 'Soulreaper', 'sc', 7, M, { lifesteal: 0.15, undeadDamage: 8 }, 'The Lich Lord\'s scythe. It reaps what it sows.', ['lich_lord']],
  ['crimson_kiss', 'The Crimson Kiss', 'dg', 6, M, { lifesteal: 0.25, crit: 0.1 }, 'The Countess\'s stiletto: one kiss, and the blood is hers.', ['countess']],
  ['runehammer', 'Runehammer', 'mc', 7, M, { stun: 0.25, pierce: 0.5 }, 'The Thane\'s hammer, every rune a battle won.', ['thane']],
  ['tidecaller', 'Tidecaller', 'sp', 6, M, { crit: 0.1, lifesteal: 0.06 }, 'The Tide Queen\'s trident. Holding it, you hear the sea.', ['tide_queen']],
  ['horizon_bow', 'Horizon', 'bw', 7, M, { crit: 0.2, speed: 0.85 }, 'The Khan\'s horn bow. It reaches as far as the eye.', ['the_khan']],
  ['judgement', 'Judgement', 'sw', 8, M, { undeadDamage: 10, crit: 0.1 }, 'The Grand Master\'s blade, blessed against the dark.', ['grand_master']],
  ['commanders_saber', 'The Commander\'s Saber', 'sw', 5, I, { crit: 0.1 }, 'Polished for parades, and sharper than it looks.', ['commander']],
  ['quicksilver_staff', 'Quicksilver', 'st', 7, I, { cleave: 0.5, pierce: 0.3 }, 'The Mad Alchemist\'s staff: its tip is a bead of moving metal.', ['mad_alchemist']],
  // the sea
  ['drowned_cutlass', 'The Drowned Cutlass', 'sw', 6, M, { lifesteal: 0.1, undeadDamage: 5 }, 'Barnacled, and never dry.', ['drowned_captain']],
  ['krakens_hook', 'The Kraken\'s Hook', 'sc', 5, M, { crit: 0.12, beastDamage: 4 }, 'Squidbeard\'s gaff, hooked like a beak.', ['squidbeard']],
  ['blackwakes_flintlock', 'Blackwake\'s Flintlock', 'pi', 6, I, { crit: 0.2 }, 'Six notches on the grip, and room for more.', ['blackwake']],
  ['kings_ransom', 'King\'s Ransom', 'sg', 8, I, { cleave: 0.7 }, 'The Pirate King\'s blunderbuss, loaded with gold teeth.', ['pirate_king']],
  // the machine age
  ['barons_long_rifle', 'The Baron\'s Long Rifle', 'lg', 7, I, { crit: 0.18, pierce: 0.3 }, 'The Iron Baron never missed with it. Neither will you.', ['iron_baron']],
  ['colossus_maul', 'The Colossus Maul', 'gs', 9, I, { stun: 0.3, machineDamage: 8 }, 'A piston from the Iron Colossus, on a girder for a handle.', ['iron_colossus']],
  ['siegebreaker', 'Siegebreaker', 'hv', 9, O, { pierce: 0.6, machineDamage: 10 }, 'The War Machine\'s main gun, cut free and carried by two.', ['war_machine']],
  ['annihilator', 'The Annihilator', 'hv', 10, O, { cleave: 0.6, machineDamage: 12 }, 'The Destroyer\'s arm cannon. Point it away from home.', ['the_destroyer']],
  ['logic_bomb', 'Logic Bomb', 'ag', 8, O, { machineDamage: 14, pierce: 0.3 }, 'The Rogue AI\'s last thought, armed and loaded.', ['rogue_ai']],
  ['mindspike', 'Mindspike', 'wd', 8, O, { pierce: 0.6, stun: 0.2 }, 'A splinter of the Overmind. It still thinks for itself.', ['overmind']],
  ['reaver_lance', 'The Reaver Lance', 'en', 10, S, { pierce: 0.6, machineDamage: 10 }, 'Torn from the Star Reaver\'s chest, and still humming.', ['star_mech']],
  ['void_repeater', 'The Void Repeater', 'ag', 10, S, { speed: 0.5, lifesteal: 0.08 }, 'It fires bits of nothing, very fast.', ['star_mech']],
  // the dungeons' bosses (dungeonBosses.ts)
  ['wightblade', 'Wightblade', 'sw', 5, N, { undeadDamage: 6, stun: 0.15 }, 'A barrow-king\'s sword, cold enough to numb the hand that holds it.', ['barrow_wight']],
  ['colossus_femur', 'The Colossus Femur', 'mc', 6, N, { stun: 0.3, undeadDamage: 4 }, 'A thighbone the length of a man, bound with grave-iron.', ['bone_colossus']],
  ['gnashers_cleaver', "Gnasher's Cleaver", 'ax', 4, N, { crit: 0.15 }, 'Chipped, greasy, and sharper than it has any right to be.', ['goblin_king']],
  ['grubspine', 'Grubspine', 'sp', 4, N, { beastDamage: 5, lifesteal: 0.06 }, 'A spear from the Grub Mother\'s barbed spine.', ['grub_mother']],
  ['tidewhisper', 'Tidewhisper', 'wd', 7, M, { stun: 0.2, lifesteal: 0.08 }, 'The Drowned Priestess\'s rod of sea-glass. It hums like a shell held to the ear.', ['drowned_priestess']],
  ['snapjaw_tooth', 'Snapjaw\'s Tooth', 'dg', 7, M, { crit: 0.2, beastDamage: 6 }, 'One tooth from Old Snapjaw, as long as a knife.', ['old_snapjaw']],
  ['hag_staff', 'The Hag\'s Crook', 'st', 7, M, { undeadDamage: 6, cleave: 0.4 }, 'Driftwood and drowned men\'s hair.', ['sea_hag']],
  ['delvers_pick', "The Delvers' Pick", 'gs', 8, M, { pierce: 0.6, stun: 0.2 }, 'A miner\'s pick, grown into the golem that killed him.', ['delvers_bane']],
  ['troll_club', 'The Troll\'s Timber', 'mc', 8, M, { stun: 0.3, cleave: 0.3 }, 'A whole mine prop, still with its nails in.', ['cave_troll']],
  ['malakars_staff', "Malakar's Staff", 'st', 9, M, { pierce: 0.5, cleave: 0.4 }, 'Stars turn in its crystal, in the wrong directions.', ['archmage_malakar']],
  ['thunderhead', 'Thunderhead', 'wd', 9, M, { stun: 0.3, crit: 0.12 }, 'The Storm Lord\'s wand. The air goes still before it speaks.', ['storm_lord']],
  ['last_page', 'The Last Page', 'wd', 8, M, { crit: 0.2, pierce: 0.3 }, 'Torn from the Hollow Librarian. Whatever it says, it says it to the target.', ['grand_grimoire']],
  ['antler_bow', 'The Antler Bow', 'lb', 8, M, { beastDamage: 8, crit: 0.12 }, 'The Erl-King\'s bow, still growing velvet.', ['erl_king']],
  ['dustwing', 'Dustwing', 'dg', 7, M, { stun: 0.2, speed: 0.8 }, 'A blade as light as a moth, that leaves a shimmer in the wound.', ['moth_queen']],
  ['broodfang', 'Broodfang', 'sp', 8, M, { lifesteal: 0.1, beastDamage: 6 }, 'A fang from Arachnis, still dripping.', ['brood_mother']],
  ['ooze_whip', 'The Ooze Lash', 'fl', 7, M, { pierce: 0.5 }, 'It eats through armour, and very nearly through the handle.', ['ooze_mother']],
  ['grimbones_hook', "Grimbones' Hook", 'sc', 7, M, { undeadDamage: 6, lifesteal: 0.08 }, 'A cargo hook that has hauled up worse than cargo.', ['bosun_grimbones']],
  ['inkblade', 'Inkblade', 'sw', 8, M, { crit: 0.18, lifesteal: 0.06 }, 'Forged in the Kraken\'s ink: it cuts, and the wound goes dark.', ['krakens_spawn']],
  ['yeti_gauntlets', 'The Yeti Fists', 'cl', 8, M, { stun: 0.25, beastDamage: 5 }, 'Two great paws, worn as gloves.', ['yeti_king']],
  ['rimefang', 'Rimefang', 'lb', 9, M, { stun: 0.25, pierce: 0.4 }, 'Strung with the Rimewyrm\'s sinew: its arrows freeze where they strike.', ['rimewyrm']],
  ['forgefather', 'Forgefather', 'mc', 9, I, { stun: 0.25, cleave: 0.4 }, 'The Forge Lord\'s own hammer, still glowing.', ['forge_lord']],
  ['magma_heart', 'The Magma Heart', 'st', 9, I, { cleave: 0.6 }, 'A staff with the Golem\'s molten heart in its head.', ['magma_golem']],
  ['salamander_lash', 'The Salamander Lash', 'fl', 8, I, { crit: 0.15, cleave: 0.3 }, 'Its tongue, dried and braided. It still burns.', ['salamander']],
  ['warden_lance', 'The Warden Lance', 'en', 9, O, { pierce: 0.6, machineDamage: 10 }, 'The Vault Warden\'s beam, cut down to a carry gun.', ['vault_warden']],
  ['prime_directive', 'Prime Directive', 'pi', 9, O, { crit: 0.25, machineDamage: 8 }, 'A sidearm from the Prime Core\'s armoury. It knows who to shoot.', ['prime_core']],
  ['ashen_glaive', 'The Ashen Glaive', 'pl', 9, I, { cleave: 0.5, beastDamage: 10 }, 'A glaive tipped with a wyrm\'s claw, grey as cinders.', ['ashen_wyrm']],
  ['elder_scale', 'Elder Scale', 'sw', 9, I, { crit: 0.15, beastDamage: 10 }, 'A blade cut from one of the Elder Drake\'s scales.', ['twin_drakes']],
  // held back for quests (from no boss)
  ['sunblade', 'Sunblade', 'sw', 9, M, { undeadDamage: 14, crit: 0.12 }, 'Forged at noon on the longest day. The dead cannot bear it.', []],
  ['whisperwind', 'Whisperwind', 'lb', 9, M, { crit: 0.25, speed: 0.9 }, 'Its string makes no sound at all.', []],
  ['the_last_light', 'The Last Light', 'st', 9, M, { undeadDamage: 10, cleave: 0.5 }, 'The staff of a wizard who held a pass alone.', []],
  ['giants_bane', 'Giant\'s Bane', 'gs', 9, M, { beastDamage: 14, stun: 0.25 }, 'Made to fell what walks over walls.', []],
  ['serpent_tongue', 'Serpent\'s Tongue', 'dg', 8, M, { lifesteal: 0.2, crit: 0.2 }, 'Forked, and it lies when it says it won\'t hurt.', []],
  ['stormcaller', 'Stormcaller', 'cb', 9, I, { pierce: 0.8, stun: 0.2 }, 'Its bolts come down like lightning.', []],
  ['widowmaker', 'Widowmaker', 'lg', 9, I, { crit: 0.3 }, 'A hunter\'s rifle with a reputation.', []],
  ['eclipse', 'Eclipse', 'sc', 10, S, { lifesteal: 0.15, cleave: 0.5 }, 'A blade of dark that drinks the light.', []],
];

/** How much harder a unique hits than a made weapon of its tier and family. */
export const UNIQUE_EDGE = 1.35;

/** The icon of the best made weapon of a family at or under a tier (uniques borrow their kind's look). */
function iconFor(fam: FamilyId, tier: number): ItemDef['icon'] {
  const same = WEAPONS.filter((w) => w.family === fam).sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
  return (same.find((w) => (w.tier ?? 0) <= tier) ?? same[same.length - 1] ?? WEAPONS[0]).icon;
}

export const UNIQUES: readonly ItemDef[] = ROWS.map(([id, name, fam, tier, era, own, lore]) => {
  const f = FAMILIES[fam];
  const effects: ItemEffects = {
    damage: Math.max(2, Math.round(tierDamage(tier) * f.dmg * UNIQUE_EDGE)),
    accuracy: (f.acc ?? 0) + 0.05,
    ...(f.ranged ? { ranged: true } : {}),
    ...(f.ammo?.[era] ? { ammo: f.ammo[era] } : {}),
    ...f.fx,
    ...own,
  };
  const words = quirkWords(effects);
  return {
    id,
    name,
    slot: 'weapon',
    station: 'campfire',
    cost: {},
    seconds: 0,
    research: ['__relic'],
    relic: true,
    unique: true,
    effects,
    family: fam,
    tier,
    description: `${lore} Unique ${f.name.toLowerCase()}: +${effects.damage} ${f.ranged ? 'ranged' : 'melee'} damage${words.length ? `; ${words.join(', ')}` : ''}.`,
    icon: iconFor(fam, tier),
  };
});

/** Who drops each unique (a quest's have none). */
export const UNIQUE_FROM: Record<string, string[]> = Object.fromEntries(ROWS.map((r) => [r[0], r[7]]));

/** A boss's loot table: the uniques it may give (one a kill, each only once in the world), the chance of one, and its
 *  purse. Built from the uniques' rows; every boss has a purse even with no unique. */
export interface BossLoot {
  uniques: string[];
  chance: number;
  coins: [number, number];
}
/** The chance a slain boss gives up one of its uniques. */
export const UNIQUE_CHANCE = 0.5;

/** A boss's table, from its id and health (a bigger boss carries more). */
export function bossLoot(id: string, hp: number): BossLoot {
  return {
    uniques: ROWS.filter((r) => r[7].includes(id)).map((r) => r[0]),
    chance: UNIQUE_CHANCE,
    coins: [Math.round(hp / 12), Math.round(hp / 6)],
  };
}

/** The uniques kept for quests. */
export const QUEST_UNIQUES: readonly string[] = ROWS.filter((r) => !r[7].length).map((r) => r[0]);
