// The menagerie (the owner's ask: 250 more creatures, from the assets): every one a sprite of DawnLike's character
// sheets (DragonDePlatino; 16px, two frames), cut into one creature sheet by tools/compose-dawn.cjs
// (renderer/art/creatures/dawn.png, MV-block layout: a block per creature, its two frames walking left and mirrored to
// the right). Each row: id, name, the sheet and cell it comes from, a tier (1 to 10: how strong, and when it turns up),
// where it lives, its family (which raids it joins), and flags. Their stats come from the tier (`statsFor`); where they
// turn up is in sim/menagerie.ts (raids by family, the land's lairs and caves, the dungeons by type, the guild's hunts).

import type { EnemyDef, Nature } from './enemies';
import type { Stock } from './materials';
import type { Era } from './eras';
import type { RaidKind } from './raids';

export type DawnSheet = 'Aquatic' | 'Avian' | 'Cat' | 'Demon' | 'Dog' | 'Elemental' | 'Humanoid' | 'Misc' | 'Pest' | 'Plant' | 'Quadraped' | 'Reptile' | 'Rodent' | 'Slime' | 'Undead';

/** Where a creature lives: which lands, places and dungeons it turns up in. */
export type Habitat = 'wild' | 'forest' | 'swamp' | 'sea' | 'cave' | 'snow' | 'desert' | 'fire' | 'sky' | 'crypt' | 'fae' | 'arcane' | 'works';

/** Which raids it joins. */
export type Family = 'vermin' | 'birds' | 'cats' | 'hounds' | 'demons' | 'elementals' | 'folk' | 'oddities' | 'crawlers' | 'plants' | 'herds' | 'serpents' | 'dragons' | 'slimes' | 'dead' | 'deep';

/** r ranged, s small, b big, h huge, u undead, p a person, m a machine, a armoured, q quick. */
type Row = [string, string, DawnSheet, number, number, number, Habitat, Family, string?];

const ROWS: Row[] = [
  // ---- the sea and the fresh water (Aquatic)
  ['razorfin', 'Razorfin', 'Aquatic', 0, 0, 1, 'sea', 'deep', 'sq'],
  ['ember_carp', 'Ember Carp', 'Aquatic', 1, 0, 2, 'sea', 'deep', 's'],
  ['gloomfish', 'Gloomfish', 'Aquatic', 2, 0, 2, 'sea', 'deep', 's'],
  ['bog_pike', 'Bog Pike', 'Aquatic', 3, 0, 1, 'swamp', 'deep', 's'],
  ['glimmerscale', 'Glimmerscale', 'Aquatic', 4, 0, 2, 'sea', 'deep', 's'],
  ['coral_crab', 'Coral Crab', 'Aquatic', 5, 0, 3, 'sea', 'deep', 'a'],
  ['drift_jelly', 'Drift Jelly', 'Aquatic', 6, 0, 2, 'sea', 'deep'],
  ['man_o_war', "Man o' War", 'Aquatic', 7, 0, 4, 'sea', 'deep'],
  ['reef_shark', 'Reef Shark', 'Aquatic', 0, 1, 4, 'sea', 'deep', 'q'],
  ['bull_shark', 'Bull Shark', 'Aquatic', 1, 1, 5, 'sea', 'deep', 'b'],
  ['tiger_shark', 'Tiger Shark', 'Aquatic', 2, 1, 6, 'sea', 'deep', 'b'],
  ['pale_whale', 'The Pale Whale', 'Aquatic', 3, 1, 8, 'sea', 'deep', 'h'],
  ['walrus', 'Bull Walrus', 'Aquatic', 5, 1, 4, 'snow', 'deep', 'b'],
  ['fire_eel', 'Fire Eel', 'Aquatic', 0, 2, 3, 'sea', 'deep'],
  ['black_eel', 'Black Eel', 'Aquatic', 2, 2, 4, 'swamp', 'deep'],
  ['storm_eel', 'Storm Eel', 'Aquatic', 3, 2, 5, 'sea', 'deep', 'r'],
  ['sea_serpent', 'Sea Serpent', 'Aquatic', 0, 3, 6, 'sea', 'deep', 'b'],
  ['tide_wyrm', 'Tide Wyrm', 'Aquatic', 1, 3, 7, 'sea', 'deep', 'b'],
  ['kelp_serpent', 'Kelp Serpent', 'Aquatic', 2, 3, 5, 'sea', 'deep'],
  ['bog_kraken', 'Bog Kraken', 'Aquatic', 0, 4, 6, 'swamp', 'deep', 'b'],
  ['weed_lurker', 'Weed Lurker', 'Aquatic', 1, 4, 4, 'swamp', 'deep'],
  ['giant_toad', 'Giant Toad', 'Aquatic', 1, 5, 2, 'swamp', 'deep'],
  // ---- birds and bats (Avian)
  ['barn_owl', 'Barn Owl', 'Avian', 0, 0, 1, 'forest', 'birds', 'sq'],
  ['moss_owl', 'Moss Owl', 'Avian', 2, 0, 2, 'forest', 'birds', 'q'],
  ['snow_owl', 'Snow Owl', 'Avian', 4, 0, 2, 'snow', 'birds', 'q'],
  ['shadow_owl', 'Shadow Owl', 'Avian', 7, 0, 4, 'forest', 'birds', 'q'],
  ['cave_bat', 'Cave Bat', 'Avian', 0, 1, 1, 'cave', 'birds', 'sq'],
  ['frost_bat', 'Frost Bat', 'Avian', 4, 1, 2, 'snow', 'birds', 'q'],
  ['fire_bat', 'Fire Bat', 'Avian', 6, 1, 3, 'fire', 'birds', 'q'],
  ['hellwing', 'Hellwing', 'Avian', 7, 1, 5, 'fire', 'birds', 'q'],
  ['blood_bat', 'Blood Bat', 'Avian', 0, 2, 2, 'crypt', 'birds', 'q'],
  ['storm_bat', 'Storm Bat', 'Avian', 4, 2, 4, 'sky', 'birds', 'q'],
  ['penguin', 'Rockhopper', 'Avian', 1, 3, 1, 'snow', 'birds', 's'],
  ['marsh_crane', 'Marsh Crane', 'Avian', 5, 3, 2, 'swamp', 'birds'],
  ['wild_swan', 'Black-Billed Swan', 'Avian', 3, 4, 2, 'swamp', 'birds'],
  ['ghost_dove', 'Ghost Dove', 'Avian', 4, 4, 3, 'crypt', 'birds', 'u'],
  ['pelican', 'Great Pelican', 'Avian', 5, 4, 2, 'sea', 'birds'],
  ['carrion_crow', 'Carrion Crow', 'Avian', 6, 4, 1, 'wild', 'birds', 'sq'],
  ['hornbill', 'Hornbill', 'Avian', 7, 4, 2, 'forest', 'birds'],
  ['war_macaw', 'War Macaw', 'Avian', 5, 5, 2, 'forest', 'birds', 'q'],
  ['vulture', 'Vulture', 'Avian', 1, 6, 2, 'desert', 'birds'],
  ['bald_eagle', 'Mountain Eagle', 'Avian', 5, 6, 3, 'sky', 'birds', 'q'],
  ['roc', 'The Roc', 'Avian', 6, 6, 7, 'sky', 'birds', 'h'],
  ['harpy_eagle', 'Harpy Eagle', 'Avian', 7, 6, 4, 'sky', 'birds', 'q'],
  ['terror_bird', 'Terror Bird', 'Avian', 1, 7, 4, 'wild', 'birds', 'b'],
  ['cassowary', 'Cassowary', 'Avian', 3, 7, 3, 'forest', 'birds'],
  ['horned_owl', 'Horned Owl', 'Avian', 4, 8, 3, 'forest', 'birds', 'q'],
  ['phoenix', 'Phoenix', 'Avian', 0, 9, 9, 'fire', 'birds', 'br'],
  ['frost_phoenix', 'Frost Phoenix', 'Avian', 2, 9, 9, 'snow', 'birds', 'br'],
  ['storm_griffon', 'Storm Griffon', 'Avian', 3, 9, 7, 'sky', 'birds', 'b'],
  ['ice_hawk', 'Ice Hawk', 'Avian', 2, 10, 3, 'snow', 'birds', 'q'],
  ['harpy', 'Harpy', 'Avian', 0, 11, 4, 'sky', 'birds', 'q'],
  ['giant_bat', 'Giant Bat', 'Avian', 2, 11, 4, 'cave', 'birds', 'b'],
  ['gargoyle', 'Gargoyle', 'Avian', 3, 11, 5, 'crypt', 'birds', 'a'],
  ['thunderbird', 'Thunderbird', 'Avian', 1, 12, 8, 'sky', 'birds', 'br'],
  // ---- the big cats (Cat)
  ['wildcat', 'Wildcat', 'Cat', 0, 0, 1, 'forest', 'cats', 'sq'],
  ['tiger', 'Tiger', 'Cat', 1, 0, 4, 'forest', 'cats', 'q'],
  ['panther', 'Black Panther', 'Cat', 2, 0, 4, 'forest', 'cats', 'q'],
  ['lynx', 'Lynx', 'Cat', 3, 0, 2, 'snow', 'cats', 'q'],
  ['sabre_tooth', 'Sabre-Tooth', 'Cat', 4, 0, 6, 'snow', 'cats', 'b'],
  ['caracal', 'Caracal', 'Cat', 0, 1, 2, 'desert', 'cats', 'q'],
  ['puma', 'Puma', 'Cat', 1, 1, 3, 'wild', 'cats', 'q'],
  ['snow_leopard', 'Snow Leopard', 'Cat', 0, 2, 3, 'snow', 'cats', 'q'],
  ['ice_tiger', 'Ice Tiger', 'Cat', 2, 2, 6, 'snow', 'cats', 'b'],
  ['shadow_cat', 'Shadow Cat', 'Cat', 0, 3, 3, 'crypt', 'cats', 'q'],
  ['dusk_panther', 'Dusk Panther', 'Cat', 2, 3, 5, 'forest', 'cats', 'q'],
  ['ember_cat', 'Ember Cat', 'Cat', 0, 4, 3, 'fire', 'cats', 'q'],
  // ---- the demons and the damned (Demon)
  ['bog_fiend', 'Bog Fiend', 'Demon', 0, 0, 4, 'swamp', 'demons'],
  ['flame_fiend', 'Flame Fiend', 'Demon', 1, 0, 5, 'fire', 'demons', 'r'],
  ['pit_hag', 'Pit Hag', 'Demon', 2, 0, 5, 'swamp', 'demons', 'r'],
  ['brute_demon', 'Brute Demon', 'Demon', 3, 0, 6, 'fire', 'demons', 'b'],
  ['ember_glutton', 'Ember Glutton', 'Demon', 4, 0, 5, 'fire', 'demons', 'b'],
  ['frost_demon', 'Frost Demon', 'Demon', 5, 0, 6, 'snow', 'demons'],
  ['rime_cyclops', 'Rime Cyclops', 'Demon', 6, 0, 7, 'snow', 'demons', 'h'],
  ['winged_fiend', 'Winged Fiend', 'Demon', 7, 0, 6, 'fire', 'demons', 'q'],
  ['fire_wraith', 'Fire Wraith', 'Demon', 0, 1, 6, 'fire', 'demons', 'r'],
  ['horned_devil', 'Horned Devil', 'Demon', 2, 1, 6, 'fire', 'demons'],
  ['pit_lord', 'Pit Lord', 'Demon', 3, 1, 9, 'fire', 'demons', 'h'],
  ['balor', 'Balor', 'Demon', 4, 1, 9, 'fire', 'demons', 'h'],
  ['ice_devil', 'Ice Devil', 'Demon', 6, 1, 7, 'snow', 'demons', 'b'],
  ['cultist', 'Cultist', 'Demon', 0, 2, 3, 'crypt', 'demons', 'pr'],
  ['goblin_warlock', 'Goblin Warlock', 'Demon', 1, 2, 4, 'cave', 'demons', 'pr'],
  ['heretic', 'Heretic', 'Demon', 3, 2, 3, 'crypt', 'demons', 'p'],
  ['mantis_demon', 'Mantis Demon', 'Demon', 4, 2, 5, 'swamp', 'demons', 'q'],
  ['ring_demon', 'Demon of the Ring', 'Demon', 6, 2, 8, 'fire', 'demons', 'br'],
  ['pale_imp', 'Pale Imp', 'Demon', 0, 3, 2, 'crypt', 'demons', 's'],
  ['frost_imp', 'Frost Imp', 'Demon', 1, 3, 2, 'snow', 'demons', 's'],
  ['red_imp', 'Red Imp', 'Demon', 2, 3, 2, 'fire', 'demons', 's'],
  ['hell_gremlin', 'Hell Gremlin', 'Demon', 2, 4, 3, 'fire', 'demons', 'sq'],
  ['flame_dancer', 'Flame Dancer', 'Demon', 0, 6, 4, 'fire', 'demons', 'r'],
  ['skull_imp', 'Skull Imp', 'Demon', 0, 7, 3, 'crypt', 'demons', 's'],
  ['toad_demon', 'Toad Demon', 'Demon', 1, 8, 4, 'swamp', 'demons', 'b'],
  // ---- dogs, foxes and wolves (Dog)
  ['jackal', 'Jackal', 'Dog', 0, 0, 1, 'desert', 'hounds', 'sq'],
  ['hyena', 'Hyena', 'Dog', 1, 0, 2, 'desert', 'hounds', 'q'],
  ['dingo', 'Dingo', 'Dog', 2, 0, 1, 'wild', 'hounds', 'q'],
  ['red_fox', 'Red Fox', 'Dog', 3, 0, 1, 'forest', 'hounds', 'sq'],
  ['gnoll', 'Gnoll', 'Dog', 5, 0, 3, 'desert', 'hounds', 'p'],
  ['dire_hound', 'Dire Hound', 'Dog', 0, 1, 3, 'wild', 'hounds', 'q'],
  ['hell_hound', 'Hell Hound', 'Dog', 1, 1, 5, 'fire', 'hounds', 'q'],
  ['frost_hound', 'Frost Hound', 'Dog', 2, 1, 3, 'snow', 'hounds', 'q'],
  ['shadow_wolf', 'Shadow Wolf', 'Dog', 4, 1, 4, 'forest', 'hounds', 'q'],
  ['gnoll_shaman', 'Gnoll Shaman', 'Dog', 5, 1, 4, 'desert', 'hounds', 'pr'],
  ['warg', 'Warg', 'Dog', 1, 2, 3, 'wild', 'hounds', 'q'],
  ['warg_alpha', 'Warg Alpha', 'Dog', 2, 2, 5, 'wild', 'hounds', 'b'],
  ['arctic_fox', 'Arctic Fox', 'Dog', 0, 3, 1, 'snow', 'hounds', 'sq'],
  ['glacier_wolf', 'Glacier Wolf', 'Dog', 2, 3, 5, 'snow', 'hounds', 'b'],
  ['black_warg', 'Black Warg', 'Dog', 2, 4, 5, 'crypt', 'hounds', 'b'],
  ['inferno_hound', 'Inferno Hound', 'Dog', 2, 5, 6, 'fire', 'hounds', 'b'],
  // ---- spirits, golems and stranger things (Elemental)
  ['ember_sprite', 'Ember Sprite', 'Elemental', 0, 0, 3, 'fire', 'elementals', 'sr'],
  ['star_sprite', 'Star Sprite', 'Elemental', 1, 0, 3, 'arcane', 'elementals', 'sr'],
  ['living_statue', 'Living Statue', 'Elemental', 2, 0, 4, 'crypt', 'elementals', 'a'],
  ['wicker_man', 'Wicker Man', 'Elemental', 3, 0, 3, 'fae', 'elementals'],
  ['clay_golem', 'Clay Golem', 'Elemental', 4, 0, 4, 'cave', 'elementals', 'a'],
  ['mud_golem', 'Mud Golem', 'Elemental', 5, 0, 4, 'swamp', 'elementals', 'a'],
  ['flesh_golem', 'Flesh Golem', 'Elemental', 7, 0, 6, 'crypt', 'elementals', 'b'],
  ['boulder_beast', 'Boulder Beast', 'Elemental', 0, 1, 3, 'cave', 'elementals', 'a'],
  ['iron_golem', 'Iron Golem', 'Elemental', 1, 1, 7, 'works', 'elementals', 'abm'],
  ['air_elemental', 'Air Elemental', 'Elemental', 2, 1, 5, 'sky', 'elementals', 'r'],
  ['brass_golem', 'Brass Golem', 'Elemental', 3, 1, 6, 'works', 'elementals', 'am'],
  ['ice_elemental', 'Ice Elemental', 'Elemental', 5, 1, 5, 'snow', 'elementals', 'b'],
  ['sand_vortex', 'Sand Vortex', 'Elemental', 1, 2, 4, 'desert', 'elementals'],
  ['void_vortex', 'Void Vortex', 'Elemental', 3, 2, 7, 'arcane', 'elementals', 'r'],
  ['water_vortex', 'Maelstrom', 'Elemental', 4, 2, 5, 'sea', 'elementals'],
  ['fire_vortex', 'Firestorm', 'Elemental', 5, 2, 6, 'fire', 'elementals', 'r'],
  ['storm_spirit', 'Storm Spirit', 'Elemental', 1, 3, 5, 'sky', 'elementals', 'r'],
  ['bog_spirit', 'Bog Spirit', 'Elemental', 3, 3, 4, 'swamp', 'elementals'],
  ['moss_orb', 'Moss Orb', 'Elemental', 0, 4, 2, 'fae', 'elementals', 's'],
  ['chaos_orb', 'Chaos Orb', 'Elemental', 3, 4, 6, 'arcane', 'elementals', 'r'],
  ['floating_eye', 'Floating Eye', 'Elemental', 0, 5, 3, 'arcane', 'elementals', 'r'],
  ['beholder', 'Beholder', 'Elemental', 2, 5, 8, 'arcane', 'elementals', 'br'],
  ['dust_devil', 'Dust Devil', 'Elemental', 0, 6, 3, 'desert', 'elementals', 'q'],
  ['hail_wisp', 'Hail Wisp', 'Elemental', 2, 6, 4, 'snow', 'elementals', 'r'],
  ['chest_lurker', 'Chest Lurker', 'Elemental', 0, 8, 4, 'crypt', 'elementals', 'a'],
  ['void_star', 'Void Star', 'Elemental', 1, 10, 7, 'arcane', 'elementals', 'r'],
  // ---- monsters who walk upright (Humanoid)
  ['hill_ogre', 'Hill Ogre', 'Humanoid', 0, 0, 5, 'wild', 'folk', 'b'],
  ['pixie', 'Pixie', 'Humanoid', 0, 3, 2, 'fae', 'folk', 'srq'],
  ['brownie', 'Brownie', 'Humanoid', 2, 3, 2, 'fae', 'folk', 's'],
  ['fae_knight', 'Fae Knight', 'Humanoid', 5, 3, 5, 'fae', 'folk', 'a'],
  ['cutpurse', 'Cutpurse', 'Humanoid', 0, 2, 2, 'wild', 'folk', 'pq'],
  ['assassin', 'Night Assassin', 'Humanoid', 5, 2, 5, 'crypt', 'folk', 'pq'],
  ['mummy_priest_h', 'Linen-Wrapped Priest', 'Humanoid', 7, 2, 5, 'desert', 'folk', 'u'],
  ['sphinx', 'Sphinx', 'Humanoid', 0, 11, 7, 'desert', 'folk', 'b'],
  ['manticore', 'Manticore', 'Humanoid', 2, 11, 7, 'desert', 'folk', 'b'],
  ['centaur', 'Centaur', 'Humanoid', 1, 13, 4, 'wild', 'folk', 'q'],
  ['centaur_archer', 'Centaur Archer', 'Humanoid', 2, 13, 4, 'wild', 'folk', 'r'],
  ['troll', 'Mountain Troll', 'Humanoid', 1, 17, 6, 'cave', 'folk', 'b'],
  ['siren', 'Siren', 'Humanoid', 0, 18, 4, 'sea', 'folk', 'r'],
  ['dryad', 'Dryad', 'Humanoid', 1, 18, 3, 'fae', 'folk', 'r'],
  ['naga', 'Naga', 'Humanoid', 0, 20, 5, 'swamp', 'folk'],
  ['merrow_warrior', 'Merrow Raider', 'Humanoid', 1, 24, 4, 'sea', 'folk'],
  // ---- odd beasts and clockwork (Misc)
  ['bugbear', 'Bugbear', 'Misc', 0, 0, 4, 'cave', 'oddities', 'b'],
  ['frost_ape', 'Frost Ape', 'Misc', 1, 0, 4, 'snow', 'oddities', 'b'],
  ['wolverine', 'Wolverine', 'Misc', 3, 0, 3, 'snow', 'oddities', 'q'],
  ['honey_badger', 'Honey Badger', 'Misc', 6, 0, 2, 'wild', 'oddities', 's'],
  ['kobold', 'Kobold', 'Misc', 0, 1, 1, 'cave', 'oddities', 's'],
  ['kobold_chief', 'Kobold Chief', 'Misc', 2, 1, 3, 'cave', 'oddities'],
  ['frog_knight', 'Frog Knight', 'Misc', 3, 1, 3, 'swamp', 'oddities', 'a'],
  ['jackalope', 'Jackalope', 'Misc', 0, 2, 1, 'wild', 'oddities', 'sq'],
  ['thunder_hare', 'Thunder Hare', 'Misc', 3, 2, 3, 'sky', 'oddities', 'q'],
  ['ape', 'Great Ape', 'Misc', 0, 3, 3, 'forest', 'oddities'],
  ['blood_ape', 'Blood Ape', 'Misc', 2, 3, 5, 'forest', 'oddities', 'b'],
  ['basilisk_red', 'Fire Basilisk', 'Misc', 0, 4, 5, 'fire', 'oddities', 'r'],
  ['cockatrice', 'Cockatrice', 'Misc', 1, 4, 4, 'wild', 'oddities'],
  ['iron_brute', 'Iron Brute', 'Misc', 0, 5, 7, 'works', 'oddities', 'abm'],
  ['steam_golem', 'Steam Golem', 'Misc', 1, 5, 6, 'works', 'oddities', 'am'],
  ['clockwork_hound', 'Clockwork Hound', 'Misc', 2, 5, 5, 'works', 'oddities', 'mq'],
  ['clockwork_imp', 'Clockwork Imp', 'Misc', 3, 5, 4, 'works', 'oddities', 'ms'],
  ['qilin', 'Qilin', 'Misc', 0, 6, 6, 'fae', 'oddities', 'b'],
  ['dragon_turtle', 'Dragon Turtle', 'Misc', 0, 7, 8, 'sea', 'oddities', 'ha'],
  // ---- things that crawl, buzz and burrow (Pest)
  ['fire_ant', 'Fire Ant', 'Pest', 0, 1, 1, 'wild', 'crawlers', 's'],
  ['giant_fly', 'Bloat Fly', 'Pest', 1, 1, 1, 'swamp', 'crawlers', 'sq'],
  ['moth', 'Dusk Moth', 'Pest', 3, 1, 2, 'forest', 'crawlers', 'q'],
  ['scarab', 'Scarab', 'Pest', 0, 2, 2, 'desert', 'crawlers', 'a'],
  ['stag_beetle', 'Stag Beetle', 'Pest', 1, 2, 3, 'forest', 'crawlers', 'a'],
  ['rhino_beetle', 'Rhino Beetle', 'Pest', 2, 2, 4, 'forest', 'crawlers', 'ab'],
  ['jewel_beetle', 'Jewel Beetle', 'Pest', 3, 2, 3, 'cave', 'crawlers', 'a'],
  ['bombardier', 'Bombardier Beetle', 'Pest', 4, 2, 4, 'wild', 'crawlers', 'r'],
  ['iron_beetle', 'Iron Beetle', 'Pest', 5, 2, 5, 'cave', 'crawlers', 'ab'],
  ['sandworm', 'Sandworm', 'Pest', 1, 3, 6, 'desert', 'crawlers', 'h'],
  ['bloodworm', 'Bloodworm', 'Pest', 3, 3, 2, 'swamp', 'crawlers'],
  ['rock_worm', 'Rock Worm', 'Pest', 4, 3, 6, 'cave', 'crawlers', 'b'],
  ['fire_spider', 'Fire Spider', 'Pest', 0, 4, 3, 'fire', 'crawlers'],
  ['giant_spider', 'Giant Spider', 'Pest', 1, 4, 3, 'cave', 'crawlers', 'b'],
  ['wasp', 'Wasp', 'Pest', 2, 4, 2, 'wild', 'crawlers', 'sq'],
  ['ice_spider', 'Ice Spider', 'Pest', 3, 4, 3, 'snow', 'crawlers'],
  ['mantis', 'Mantis', 'Pest', 0, 5, 3, 'forest', 'crawlers', 'q'],
  ['locust', 'Locust', 'Pest', 1, 5, 2, 'desert', 'crawlers', 'sq'],
  ['lantern_bug', 'Lantern Bug', 'Pest', 0, 6, 2, 'swamp', 'crawlers', 's'],
  ['giant_snail', 'Giant Snail', 'Pest', 2, 7, 2, 'swamp', 'crawlers', 'a'],
  ['shell_crawler', 'Shell Crawler', 'Pest', 3, 7, 3, 'cave', 'crawlers', 'a'],
  ['crystal_spider', 'Crystal Spider', 'Pest', 1, 9, 4, 'cave', 'crawlers', 'a'],
  ['blood_tick', 'Blood Tick', 'Pest', 0, 10, 2, 'swamp', 'crawlers', 's'],
  // ---- the green and growing (Plant)
  ['bog_tree', 'Bog Tree', 'Plant', 0, 0, 5, 'swamp', 'plants', 'b'],
  ['thorn_tree', 'Thorn Tree', 'Plant', 1, 0, 4, 'forest', 'plants', 'a'],
  ['mandrake', 'Mandrake', 'Plant', 2, 0, 3, 'fae', 'plants', 'r'],
  ['fire_tree', 'Burning Tree', 'Plant', 3, 0, 5, 'fire', 'plants', 'b'],
  ['frost_tree', 'Frost Tree', 'Plant', 4, 0, 4, 'snow', 'plants', 'a'],
  ['ghost_tree', 'Ghost Tree', 'Plant', 5, 0, 5, 'crypt', 'plants', 'u'],
  ['pine_ent', 'Pine Ent', 'Plant', 0, 1, 4, 'forest', 'plants', 'b'],
  ['blossom_fiend', 'Blossom Fiend', 'Plant', 3, 1, 3, 'fae', 'plants', 'r'],
  ['snapvine', 'Snapvine', 'Plant', 1, 2, 2, 'forest', 'plants', 's'],
  ['corpse_flower', 'Corpse Flower', 'Plant', 0, 6, 4, 'swamp', 'plants', 'r'],
  ['shambling_mound', 'Shambling Mound', 'Plant', 1, 6, 4, 'swamp', 'plants', 'b'],
  ['toadstool', 'Walking Toadstool', 'Plant', 0, 7, 1, 'forest', 'plants', 's'],
  // ---- hoofed and horned (Quadraped)
  ['bison', 'Bison', 'Quadraped', 0, 0, 3, 'wild', 'herds', 'b'],
  ['yak', 'Wild Yak', 'Quadraped', 1, 0, 2, 'snow', 'herds'],
  ['aurochs', 'Aurochs', 'Quadraped', 2, 0, 3, 'wild', 'herds', 'b'],
  ['black_bull', 'Black Bull', 'Quadraped', 5, 0, 4, 'wild', 'herds', 'b'],
  ['night_mare', 'Night Mare', 'Quadraped', 7, 0, 5, 'crypt', 'herds', 'q'],
  ['ice_elk', 'Ice Elk', 'Quadraped', 0, 1, 3, 'snow', 'herds'],
  ['frost_ram', 'Frost Ram', 'Quadraped', 1, 1, 3, 'snow', 'herds'],
  ['moose', 'Moose', 'Quadraped', 3, 1, 3, 'forest', 'herds', 'b'],
  ['unicorn', 'Unicorn', 'Quadraped', 0, 2, 6, 'fae', 'herds', 'q'],
  ['rhino', 'Rhino', 'Quadraped', 2, 2, 4, 'desert', 'herds', 'ab'],
  ['war_rhino', 'War Rhino', 'Quadraped', 3, 2, 6, 'desert', 'herds', 'ab'],
  ['ankylosaur', 'Ankylosaur', 'Quadraped', 3, 3, 6, 'wild', 'herds', 'ah'],
  ['pegasus', 'Pegasus', 'Quadraped', 1, 4, 4, 'sky', 'herds', 'q'],
  ['nightmare_steed', 'Nightmare', 'Quadraped', 3, 4, 6, 'fire', 'herds', 'q'],
  ['grizzly', 'Grizzly', 'Quadraped', 0, 5, 3, 'forest', 'herds', 'b'],
  ['owlbear', 'Owlbear', 'Quadraped', 2, 5, 5, 'forest', 'herds', 'b'],
  ['mastodon', 'Mastodon', 'Quadraped', 0, 6, 6, 'snow', 'herds', 'h'],
  ['doom_beast', 'Doom Beast', 'Quadraped', 2, 7, 7, 'crypt', 'herds', 'b'],
  ['fire_elk', 'Fire Elk', 'Quadraped', 0, 8, 4, 'fire', 'herds'],
  ['war_elephant', 'War Elephant', 'Quadraped', 0, 9, 7, 'desert', 'herds', 'ha'],
  ['ice_behemoth', 'Ice Behemoth', 'Quadraped', 1, 10, 8, 'snow', 'herds', 'h'],
  // ---- snakes, lizards and dragons (Reptile)
  ['red_lizard', 'Red Lizard', 'Reptile', 0, 0, 1, 'desert', 'serpents', 's'],
  ['sand_viper', 'Sand Viper', 'Reptile', 2, 0, 2, 'desert', 'serpents', 'q'],
  ['green_dragon', 'Green Dragon', 'Reptile', 4, 0, 9, 'forest', 'dragons', 'hr'],
  ['jade_dragon', 'Jade Dragon', 'Reptile', 5, 0, 9, 'fae', 'dragons', 'hr'],
  ['green_mamba', 'Green Mamba', 'Reptile', 6, 0, 2, 'forest', 'serpents', 'q'],
  ['tree_python', 'Tree Python', 'Reptile', 7, 0, 3, 'forest', 'serpents'],
  ['ember_wyrmling', 'Ember Wyrmling', 'Reptile', 0, 1, 4, 'fire', 'dragons', 'r'],
  ['golden_wyrmling', 'Golden Wyrmling', 'Reptile', 1, 1, 4, 'desert', 'dragons'],
  ['blue_dragon', 'Blue Dragon', 'Reptile', 3, 1, 9, 'sky', 'dragons', 'hr'],
  ['gold_dragon', 'Gold Dragon', 'Reptile', 4, 1, 10, 'desert', 'dragons', 'hr'],
  ['sea_dragon', 'Sea Dragon', 'Reptile', 7, 1, 8, 'sea', 'dragons', 'hr'],
  ['black_drake', 'Black Drake', 'Reptile', 0, 2, 5, 'cave', 'dragons', 'b'],
  ['shadow_dragon', 'Shadow Dragon', 'Reptile', 1, 2, 10, 'crypt', 'dragons', 'hr'],
  ['white_dragon', 'White Dragon', 'Reptile', 2, 2, 9, 'snow', 'dragons', 'hr'],
  ['swamp_drake', 'Swamp Drake', 'Reptile', 4, 2, 5, 'swamp', 'dragons', 'b'],
  ['copper_dragon', 'Copper Dragon', 'Reptile', 7, 2, 8, 'cave', 'dragons', 'hr'],
  ['red_drake', 'Red Drake', 'Reptile', 0, 3, 5, 'fire', 'dragons', 'br'],
  ['inferno_dragon', 'Inferno Dragon', 'Reptile', 3, 3, 10, 'fire', 'dragons', 'hr'],
  ['azure_hydra', 'Azure Hydra', 'Reptile', 4, 3, 8, 'sea', 'dragons', 'h'],
  ['hydra', 'Hydra', 'Reptile', 5, 3, 8, 'swamp', 'dragons', 'h'],
  ['cobra', 'Cobra', 'Reptile', 2, 4, 2, 'desert', 'serpents', 'r'],
  ['night_viper', 'Night Viper', 'Reptile', 4, 4, 3, 'crypt', 'serpents', 'q'],
  ['blood_viper', 'Blood Viper', 'Reptile', 5, 4, 3, 'swamp', 'serpents', 'q'],
  ['grass_snake', 'Grass Snake', 'Reptile', 7, 4, 1, 'wild', 'serpents', 'sq'],
  ['sand_naga', 'Sand Naga', 'Reptile', 0, 5, 4, 'desert', 'serpents'],
  ['flame_naga', 'Flame Naga', 'Reptile', 2, 5, 5, 'fire', 'serpents', 'r'],
  ['abyss_naga', 'Abyss Naga', 'Reptile', 3, 5, 6, 'sea', 'serpents', 'r'],
  ['coral_naga', 'Coral Naga', 'Reptile', 6, 5, 5, 'sea', 'serpents'],
  ['couatl', 'Couatl', 'Reptile', 0, 7, 6, 'sky', 'serpents', 'r'],
  ['swamp_croc', 'Swamp Gator', 'Reptile', 0, 8, 3, 'swamp', 'serpents', 'ab'],
  ['bullfrog', 'Bullfrog', 'Reptile', 2, 8, 2, 'swamp', 'serpents'],
  ['komodo', 'Komodo Dragon', 'Reptile', 1, 9, 3, 'wild', 'serpents', 'b'],
  ['bone_lizard', 'Bone Lizard', 'Reptile', 1, 10, 3, 'crypt', 'serpents', 'u'],
  ['basilisk', 'Basilisk', 'Reptile', 2, 10, 6, 'cave', 'serpents', 'r'],
  ['snapping_turtle', 'Snapping Turtle', 'Reptile', 0, 11, 2, 'swamp', 'serpents', 'a'],
  ['lava_tortoise', 'Lava Tortoise', 'Reptile', 1, 11, 5, 'fire', 'serpents', 'ab'],
  ['red_wyvern', 'Red Wyvern', 'Reptile', 2, 11, 6, 'fire', 'dragons', 'b'],
  // ---- the rodents (Rodent)
  ['red_squirrel', 'Red Squirrel', 'Rodent', 0, 0, 1, 'forest', 'vermin', 'sq'],
  ['ferret', 'Ferret', 'Rodent', 2, 0, 1, 'wild', 'vermin', 'sq'],
  ['beaver', 'Giant Beaver', 'Rodent', 4, 0, 2, 'swamp', 'vermin'],
  ['dire_rat', 'Dire Rat', 'Rodent', 3, 1, 3, 'cave', 'vermin', 'b'],
  ['mole', 'Giant Mole', 'Rodent', 2, 2, 2, 'cave', 'vermin'],
  ['ratfolk', 'Ratfolk', 'Rodent', 0, 3, 3, 'cave', 'vermin', 'p'],
  // ---- oozes (Slime)
  ['bubble_slime', 'Bubble Slime', 'Slime', 0, 0, 1, 'swamp', 'slimes', 's'],
  ['mud_slime', 'Mud Slime', 'Slime', 1, 0, 1, 'swamp', 'slimes', 's'],
  ['pearl_slime', 'Pearl Slime', 'Slime', 2, 0, 2, 'sea', 'slimes', 's'],
  ['magma_slime', 'Magma Slime', 'Slime', 4, 0, 3, 'fire', 'slimes'],
  ['rainbow_slime', 'Rainbow Slime', 'Slime', 5, 0, 3, 'fae', 'slimes'],
  ['water_blob', 'Water Blob', 'Slime', 0, 1, 2, 'sea', 'slimes'],
  ['tar_pit', 'Tar Pit', 'Slime', 1, 1, 3, 'works', 'slimes', 'a'],
  ['shadow_ooze', 'Shadow Ooze', 'Slime', 2, 1, 4, 'crypt', 'slimes'],
  ['gazer_ooze', 'Gazer Ooze', 'Slime', 1, 2, 4, 'arcane', 'slimes', 'r'],
  ['gelatinous_cube', 'Gelatinous Cube', 'Slime', 2, 2, 5, 'cave', 'slimes', 'b'],
  ['ice_jelly', 'Ice Jelly', 'Slime', 0, 3, 2, 'snow', 'slimes'],
  ['spore_cloud', 'Spore Cloud', 'Slime', 0, 4, 2, 'swamp', 'slimes', 'r'],
  // ---- the restless dead (Undead)
  ['rotling', 'Rotling', 'Undead', 0, 0, 1, 'crypt', 'dead', 'su'],
  ['ghoul', 'Ghoul', 'Undead', 1, 0, 3, 'crypt', 'dead', 'uq'],
  ['bog_zombie', 'Bog Zombie', 'Undead', 2, 0, 2, 'swamp', 'dead', 'u'],
  ['plague_zombie', 'Plague Zombie', 'Undead', 4, 0, 3, 'crypt', 'dead', 'u'],
  ['zombie_ogre', 'Zombie Ogre', 'Undead', 6, 0, 5, 'crypt', 'dead', 'ub'],
  ['flesh_giant', 'Flesh Giant', 'Undead', 7, 0, 7, 'crypt', 'dead', 'uh'],
  ['linen_mummy', 'Linen Mummy', 'Undead', 1, 1, 3, 'desert', 'dead', 'u'],
  ['desert_mummy', 'Desert Mummy', 'Undead', 2, 1, 4, 'desert', 'dead', 'u'],
  ['mummy_lord', 'Mummy Lord', 'Undead', 5, 1, 6, 'desert', 'dead', 'ub'],
  ['pharaoh', 'The Risen Pharaoh', 'Undead', 6, 1, 8, 'desert', 'dead', 'ubr'],
  ['frost_skeleton', 'Frost Skeleton', 'Undead', 0, 2, 3, 'snow', 'dead', 'u'],
  ['lich_acolyte', 'Lich Acolyte', 'Undead', 1, 2, 5, 'crypt', 'dead', 'ur'],
  ['charred_skeleton', 'Charred Skeleton', 'Undead', 3, 2, 3, 'fire', 'dead', 'u'],
  ['skeleton_mage', 'Skeleton Mage', 'Undead', 4, 2, 4, 'crypt', 'dead', 'ur'],
  ['bone_knight', 'Bone Knight', 'Undead', 5, 2, 5, 'crypt', 'dead', 'ua'],
  ['death_knight', 'Death Knight', 'Undead', 6, 2, 7, 'crypt', 'dead', 'uab'],
  ['wraith_archer', 'Wraith Archer', 'Undead', 1, 3, 4, 'crypt', 'dead', 'ur'],
  ['revenant', 'Revenant Captain', 'Undead', 3, 3, 5, 'crypt', 'dead', 'ua'],
  ['poltergeist', 'Poltergeist', 'Undead', 0, 4, 2, 'crypt', 'dead', 'uq'],
  ['banshee', 'Banshee', 'Undead', 2, 4, 5, 'crypt', 'dead', 'ur'],
  ['grim_reaper', 'The Grim Reaper', 'Undead', 0, 5, 9, 'crypt', 'dead', 'ub'],
  ['bone_serpent', 'Bone Serpent', 'Undead', 1, 6, 5, 'crypt', 'dead', 'ub'],
  ['dread_lord', 'Dread Lord', 'Undead', 1, 7, 7, 'crypt', 'dead', 'ur'],
  ['bone_hound', 'Bone Hound', 'Undead', 0, 9, 3, 'crypt', 'dead', 'uq'],
];

/** A menagerie creature's place in the world. */
export interface Beast {
  id: string;
  tier: number;
  habitat: Habitat;
  family: Family;
  /** Where its sprite came from (for the composer and the Bestiary page). */
  sheet: DawnSheet;
  cell: [number, number];
  /** Its block on the composed sheet. */
  block: number;
}

/** The tier's stats: health, blows, aim, dodge and pace; bigger and smaller creatures are stretched from them. */
export function statsFor(tier: number, flags: string): Pick<EnemyDef, 'hp' | 'damage' | 'accuracy' | 'dodge' | 'interval' | 'ranged'> & { armor?: number } {
  const size = flags.includes('h') ? 1.9 : flags.includes('b') ? 1.4 : flags.includes('s') ? 0.65 : 1;
  const hp = Math.round((8 + tier * 15 + tier * tier * 2) * size);
  const lo = Math.round((1 + tier * 1.6) * (size > 1 ? 1.15 : size < 1 ? 0.8 : 1));
  const hi = Math.round(lo * 1.6 + 1);
  return {
    hp,
    damage: [lo, hi],
    accuracy: +(0.62 + tier * 0.02).toFixed(2),
    dodge: +(flags.includes('q') ? 0.14 + tier * 0.01 : flags.includes('h') ? 0.02 : 0.06 + tier * 0.006).toFixed(3),
    interval: +(flags.includes('q') ? 1.3 : flags.includes('h') ? 2.4 : flags.includes('b') ? 2 : 1.7).toFixed(1),
    ranged: flags.includes('r'),
    ...(flags.includes('a') ? { armor: Math.min(0.4, 0.1 + tier * 0.03) } : {}),
  };
}

/** What a creature leaves: by its family, more with the tier; the bigger ones a monster part for the guild. */
function lootFor(family: Family, tier: number): Stock {
  const n = Math.max(1, Math.round(tier / 2));
  const base: Record<Family, Stock> = {
    vermin: { meat: 1, hide: 1 },
    birds: { meat: n, fiber: 1 },
    cats: { meat: n, hide: n },
    hounds: { meat: n, hide: 1 },
    demons: { bone: n },
    elementals: { stone: n * 2 },
    folk: { cloth: 1, iron: tier >= 4 ? 1 : 0 },
    oddities: { meat: 1, hide: 1, bone: 1 },
    crawlers: { herbs: 1 },
    plants: { wood: n * 2, herbs: 1 },
    herds: { meat: n * 2, hide: n },
    serpents: { meat: 1, hide: 1 },
    dragons: { bone: n, hide: n },
    slimes: { herbs: n },
    dead: { bone: n },
    deep: { fish: n * 2 },
  };
  const out: Stock = { ...base[family] };
  // (a monster part for the hunters' guild from anything with some strength to it: data/hunts.ts)
  const part: Partial<Record<Family, keyof Stock>> = {
    hounds: 'beast_fang', cats: 'beast_fang', herds: 'great_horn', crawlers: 'chitin', serpents: 'venom_sac', slimes: 'venom_sac',
    dragons: 'wyrm_scale', dead: 'ghost_essence', demons: 'monster_heart', elementals: 'monster_heart', oddities: 'thick_pelt', deep: 'venom_sac', birds: 'thick_pelt', plants: 'venom_sac', folk: 'thick_pelt', vermin: 'beast_fang',
  };
  if (tier >= 4 && part[family]) out[part[family]!] = Math.max(1, Math.floor((tier - 2) / 3));
  if (family === 'dragons' && tier >= 9) out.dragon_heart = 1;
  for (const k of Object.keys(out) as (keyof Stock)[]) if (!out[k]) delete out[k];
  return out;
}

/** Blocks across the composed sheet (renderer/art/creatures/dawn.png). */
export const DAWN_ACROSS = 16;

export const MENAGERIE_ROWS: readonly Row[] = ROWS;

export const BEASTS: readonly Beast[] = ROWS.map(([id, , sheet, x, y, tier, habitat, family], block) => ({ id, tier, habitat, family, sheet, cell: [x, y], block }));
export const BEAST_BY_ID: Record<string, Beast> = Object.fromEntries(BEASTS.map((b) => [b.id, b]));

const natureOfRow = (flags: string): Nature | undefined => (flags.includes('u') ? 'undead' : flags.includes('m') ? 'machine' : flags.includes('p') ? 'person' : undefined);

/** The menagerie as enemies, merged into ENEMIES. */
export const MENAGERIE: Record<string, EnemyDef> = Object.fromEntries(
  ROWS.map(([id, name, , , , tier, , family, flags = ''], block) => {
    const st = statsFor(tier, flags);
    const scale = flags.includes('h') ? 5 : flags.includes('b') ? 4 : flags.includes('s') ? 2.5 : 3;
    const nature = natureOfRow(flags) ?? (family === 'dead' ? 'undead' : undefined);
    const def: EnemyDef = { id, name, ...st, loot: lootFor(family, tier), sprite: { sheet: 'dawn', block, scale }, ...(nature ? { nature } : {}) };
    return [id, def];
  }),
);

/** What a creature costs out of a raid's budget (as the hand-made raid kinds price theirs: by health). */
export const raidCost = (id: string) => Math.round(4 + (MENAGERIE[id]?.hp ?? 40) * 0.12);

/* ------------------------------------------------------------ where they turn up */


/** The tiers met in each age: a town meets the weak early and the terrible late. */
export const TIERS_BY_ERA: Record<Era, [number, number]> = { neolithic: [1, 3], medieval: [3, 6], industrial: [5, 8], modern: [6, 9], space: [7, 10] };

/** The creatures of these habitats within these tiers. */
export const beastsOf = (habitats: readonly Habitat[], [lo, hi]: [number, number]): Beast[] => BEASTS.filter((b) => habitats.includes(b.habitat) && b.tier >= lo && b.tier <= hi);

/** A group of one kind, as many as its tier allows. */
export const groupOf = (b: Beast): Record<string, number> => ({ [b.id]: b.tier <= 2 ? 3 : b.tier <= 4 ? 2 : 1 });

/** The land's own habitats: a lair in the wild, a cave, the reef; the land's biome adds its own. */
export function placeHabitats(kind: 'beast' | 'cave' | 'reef', biome: string | undefined): Habitat[] {
  if (kind === 'reef') return ['sea'];
  if (kind === 'cave') return ['cave', 'crypt', 'arcane'];
  const own: Habitat[] = biome === 'tundra' ? ['snow'] : biome === 'desert' ? ['desert'] : biome === 'coast' ? ['swamp', 'sky'] : ['forest', 'fae'];
  return ['wild', ...own];
}

/** Each dungeon type's own habitats. */
export const DUNGEON_HABITATS: Record<string, Habitat[]> = {
  crypt: ['crypt'], warren: ['cave', 'swamp'], mine: ['cave', 'works'], fey: ['fae', 'forest'], temple: ['desert', 'crypt'],
  tower: ['arcane'], nest: ['sky', 'fire'], wreck: ['sea'], ice: ['snow'], forge: ['fire', 'works'], vault: ['works', 'arcane'], den: ['wild', 'forest'],
};
/** How many of the menagerie's groups a dungeon adds to its own. */
export const DUNGEON_GROUPS = 6;
/** A dungeon's groups from the menagerie, by its type and age (`foes` in data/dungeons.ts). */
export const dungeonGroups = (type: string, era: Era): Record<string, number>[] => {
  const [lo, hi] = TIERS_BY_ERA[era];
  // (at most `DUNGEON_GROUPS` of them, spread over the tiers, so the dungeon's own foes still come)
  const all = beastsOf(DUNGEON_HABITATS[type] ?? ['wild'], [lo, hi]).sort((a, b) => a.tier - b.tier || a.block - b.block);
  const step = Math.max(1, all.length / DUNGEON_GROUPS);
  return Array.from({ length: Math.min(DUNGEON_GROUPS, all.length) }, (_, i) => groupOf(all[Math.floor(i * step)]));
};

/** The raids the menagerie comes in: one for each family (the ice's and the dunes' own besides), from the age its
 *  members belong to; the budget keeps the great ones away until a town is strong enough to draw them. */
const FAMILY_RAIDS: Record<Family, { name: string; plural: boolean; goal: RaidKind['goal']; goals?: RaidKind['goals']; steals?: RaidKind['steals']; speed: number; era?: Era; weight: number }> = {
  vermin: { name: 'A swarm of vermin', plural: false, goal: 'steal', goals: { steal: 3, harm: 1 }, steals: 'food', speed: 75, weight: 0.8 },
  birds: { name: 'A dark flock', plural: false, goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', speed: 90, weight: 0.6 },
  cats: { name: 'Prowling cats', plural: true, goal: 'harm', goals: { harm: 3, kidnap: 1 }, speed: 80, weight: 0.5 },
  hounds: { name: 'Hunting hounds', plural: true, goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', speed: 85, weight: 0.7 },
  demons: { name: 'A demon incursion', plural: false, goal: 'harm', goals: { harm: 3, burn: 2, kidnap: 1 }, speed: 55, era: 'medieval', weight: 0.6 },
  elementals: { name: 'Wild spirits', plural: true, goal: 'harm', goals: { harm: 3, burn: 1 }, speed: 50, weight: 0.5 },
  folk: { name: 'Strange folk from the hills', plural: true, goal: 'steal', goals: { steal: 3, kidnap: 1, harm: 1 }, steals: 'valuables', speed: 60, weight: 0.5 },
  oddities: { name: 'Beasts of the wild', plural: true, goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', speed: 65, weight: 0.6 },
  crawlers: { name: 'The crawling swarm', plural: false, goal: 'harm', goals: { harm: 2, steal: 2 }, steals: 'food', speed: 55, weight: 0.7 },
  plants: { name: 'The walking wood', plural: false, goal: 'harm', goals: { harm: 4 }, speed: 30, weight: 0.4 },
  herds: { name: 'A stampede', plural: false, goal: 'harm', goals: { harm: 3, burn: 1 }, speed: 80, weight: 0.6 },
  serpents: { name: 'Serpents and lizards', plural: true, goal: 'harm', goals: { harm: 3, kidnap: 1 }, speed: 55, weight: 0.6 },
  dragons: { name: 'Dragonkind', plural: false, goal: 'harm', goals: { harm: 3, burn: 3, steal: 1 }, steals: 'valuables', speed: 70, era: 'medieval', weight: 0.35 },
  slimes: { name: 'A tide of slime', plural: false, goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', speed: 35, weight: 0.5 },
  dead: { name: 'The hungry dead', plural: true, goal: 'harm', goals: { harm: 4, kidnap: 1 }, speed: 35, weight: 0.6 },
  deep: { name: 'Things from the water', plural: true, goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', speed: 50, weight: 0.8 },
};

const kindOf = (id: string, f: (typeof FAMILY_RAIDS)[Family], members: Beast[], more: Partial<RaidKind> = {}): RaidKind => ({
  id,
  name: f.name,
  goal: f.goal,
  ...(f.goals ? { goals: f.goals } : {}),
  ...(f.steals ? { steals: f.steals } : {}),
  enemies: Object.fromEntries(members.map((b) => [b.id, raidCost(b.id)])),
  fromDay: 3,
  ...(f.era ? { era: f.era } : {}),
  weight: f.weight,
  speed: f.speed,
  bribable: false,
  plural: f.plural,
  ...more,
});

/** Raid kinds by age: each age's raid of a family brings only that age's tiers (`TIERS_BY_ERA`), so a camp of the
 *  Stone Age meets wolves' kin, not tigers; the family's own first age (demons and dragons from the Medieval) besides. */
/** Raids come to the town's door, so they keep to gentler tiers than the lairs and dungeons a party chooses to go to
 *  (a Stone Age camp at tier 3 grew half as fast). */
export const RAID_TIERS: Record<Era, [number, number]> = { neolithic: [1, 2], medieval: [2, 5], industrial: [4, 7], modern: [6, 9], space: [7, 10] };
const ERA_ORDER: readonly Era[] = ['neolithic', 'medieval', 'industrial', 'modern', 'space'];
const byAge = (id: string, f: (typeof FAMILY_RAIDS)[Family], pool: Beast[], more: Partial<RaidKind> = {}): RaidKind[] =>
  ERA_ORDER.filter((e) => !f.era || ERA_ORDER.indexOf(e) >= ERA_ORDER.indexOf(f.era)).map((e) => {
    const [lo, hi] = RAID_TIERS[e];
    return kindOf(`${id}_${e}`, f, pool.filter((b) => b.tier >= lo && b.tier <= hi), { era: e, untilEra: e, ...more });
  });

export const MENAGERIE_RAIDS: readonly RaidKind[] = [
  // (each family, without the ice's, the dunes' and the sea's own: those come only where they live)
  ...(Object.keys(FAMILY_RAIDS) as Family[])
    .filter((f) => f !== 'deep')
    .flatMap((f) => byAge(`m_${f}`, FAMILY_RAIDS[f], BEASTS.filter((b) => b.family === f && !['snow', 'desert', 'sea'].includes(b.habitat)))),
  ...byAge('m_ice', { ...FAMILY_RAIDS.oddities, name: 'Beasts of the ice', weight: 1.2 }, BEASTS.filter((b) => b.habitat === 'snow'), { biomes: ['tundra'] }),
  ...byAge('m_dunes', { ...FAMILY_RAIDS.oddities, name: 'Beasts of the dunes', weight: 1.2 }, BEASTS.filter((b) => b.habitat === 'desert'), { biomes: ['desert'] }),
  ...byAge('m_deep', FAMILY_RAIDS.deep, BEASTS.filter((b) => b.habitat === 'sea'), { fromSea: true }),
].filter((k) => Object.keys(k.enemies).length > 0);

/* ------------------------------------------------------------ the guild's hunts */

/** The part each family gives up to a hunter (data/hunts.ts COMPONENTS). */
export const FAMILY_PART: Record<Family, string> = {
  hounds: 'beast_fang', cats: 'beast_fang', vermin: 'beast_fang', herds: 'great_horn', crawlers: 'chitin', serpents: 'venom_sac', slimes: 'venom_sac',
  dragons: 'wyrm_scale', dead: 'ghost_essence', demons: 'monster_heart', elementals: 'monster_heart', oddities: 'thick_pelt', deep: 'venom_sac', birds: 'thick_pelt', plants: 'venom_sac', folk: 'thick_pelt',
};
const HUNT_LINES: Record<Family, string> = {
  vermin: 'Something has been gnawing through the granaries of three villages.',
  birds: 'It strikes from the sky at shepherds and their flocks.',
  cats: 'It stalks the roads at dusk, and travellers stop coming.',
  hounds: 'They run the hills at night, and the farms keep their dogs in.',
  demons: 'A thing from below, loose on the land. The priests will not go near it.',
  elementals: 'A wild spirit, raging where the ley lines cross.',
  folk: 'It walks like a man and kills like a beast.',
  oddities: 'Nobody can say quite what it is, only that it has to die.',
  crawlers: 'Its brood is spreading. Burn it out before it hatches more.',
  plants: 'The woods have started to move, and to eat.',
  herds: 'A beast too big to fence and too angry to turn.',
  serpents: 'Its venom has killed a dozen beasts and two herders.',
  dragons: 'A dragon. The guild pays the most for these, and buries the most hunters.',
  slimes: 'It dissolves fences, sheep, and the men sent to clear it.',
  dead: 'It should be in its grave. Send it back.',
  deep: 'It drags fishermen under. The boats stay in.',
};

/** More than one of them: "Linen Mummies", "Wargs", "Ratfolk". */
export const plural = (name: string) =>
  /folk$/.test(name) ? name : /[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(name) ? `${name}es` : /man$/.test(name) ? `${name.slice(0, -3)}men` : `${name}s`;

/** A hunt for each menagerie creature of tier 2 or more: its stars by tier, a part or two by family. */
export const MENAGERIE_QUARRIES = BEASTS.filter((b) => b.tier >= 2).map((b) => {
  const name = MENAGERIE[b.id].name;
  const group = groupOf(b);
  const stars = Math.max(1, Math.min(5, Math.ceil(b.tier / 2))) as 1 | 2 | 3 | 4 | 5;
  const era: Era = b.tier >= 6 ? 'medieval' : 'neolithic';
  const scenery: 'thicket' | 'river' | 'woods' | 'quarry' | 'cave' = ['sea', 'swamp'].includes(b.habitat) ? 'river' : ['cave', 'crypt', 'arcane', 'works'].includes(b.habitat) ? 'cave' : ['snow', 'desert', 'fire', 'sky'].includes(b.habitat) ? 'quarry' : b.habitat === 'wild' ? 'thicket' : 'woods';
  const parts = { [FAMILY_PART[b.family]]: Math.max(1, Math.ceil(b.tier / 3)), ...(b.family === 'dragons' && b.tier >= 9 ? { dragon_heart: 1 } : {}) };
  return { id: `m_${b.id}`, name: group[b.id] > 1 ? plural(name) : name, stars, era, foes: group, parts, scenery, text: HUNT_LINES[b.family] };
});
