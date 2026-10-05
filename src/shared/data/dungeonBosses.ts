// The bosses at the bottom of the dungeons (dungeons.ts): two or three for each kind of dungeon, one met per delve.
// Drawn from the creature sheets already in the game, bigger, and tinted to their own colours. They carry no trophy:
// what they guard is the dungeon's hoard, a purse, and now and then a unique (uniques.ts).

import type { BossKit, CreatureSheetId, EnemyDef, Nature } from './enemies';
import { PACK_SHEETS, type PackSheetId } from './packSheets';
import type { Stock } from './materials';

type Def = {
  name: string;
  hp: number;
  dmg: [number, number];
  ranged?: boolean;
  /** A creature sheet and block, or a pack sheet; how tall it's drawn; its tint. */
  sheet: CreatureSheetId;
  block?: number;
  height?: number;
  scale?: number;
  tint?: number;
  look?: EnemyDef['look'];
  nature?: Nature;
  armor?: number;
  loot: Stock;
  kit: Omit<BossKit, 'trophy'>;
};
const isPack = (s: string): s is PackSheetId => s in PACK_SHEETS;
const boss = (id: string, d: Def): EnemyDef => ({
  id,
  name: d.name,
  hp: d.hp,
  damage: d.dmg,
  accuracy: 0.76,
  dodge: 0.08,
  interval: 1.5,
  ranged: !!d.ranged,
  boss: true,
  loot: d.loot,
  kit: d.kit,
  sprite: isPack(d.sheet) ? { sheet: d.sheet, block: 0, scale: +((d.height ?? 70) / PACK_SHEETS[d.sheet]).toFixed(2) } : { sheet: d.sheet, block: d.block ?? 0, scale: d.scale ?? 1.6 },
  ...(d.tint ? { tint: d.tint } : {}),
  ...(d.look ? { look: d.look } : {}),
  ...(d.nature ? { nature: d.nature } : {}),
  ...(d.armor ? { armor: d.armor } : {}),
});

export const DUNGEON_BOSSES: Record<string, EnemyDef> = {
  // the crypts
  barrow_wight: boss('barrow_wight', { name: 'The Barrow Wight', hp: 300, dmg: [12, 19], sheet: 'skeleton_spearman', height: 100, tint: 0xc8d8ff, look: { grey: true, bright: 1.25 }, nature: 'undead', loot: { bone: 8, cloth: 3 },
    kit: { roar: 'A cold voice from the barrow: "Who wakes the old king?"', enrage: 'The Wight\'s eyes burn blue: the grave-cold spreads!', area: { every: 3, targets: 3, name: 'breathes the barrow-chill', fx: 'frost' }, summon: { kind: 'skeleton_warrior', count: 2, text: 'The Wight raises its old guard from their niches!' } } }),
  bone_colossus: boss('bone_colossus', { name: 'The Bone Colossus', hp: 420, dmg: [14, 22], sheet: 'skeleton_warrior', height: 96, look: { grey: true, bright: 1.3 }, nature: 'undead', armor: 0.15, loot: { bone: 14 },
    kit: { roar: 'The bones of a hundred dead knit into one giant, and it stands.', enrage: 'Ribs crack and splinter: the Colossus swings wild!', area: { every: 3, targets: 3, name: 'sweeps a femur like a club', fx: 'quake' } } }),
  // the warrens
  goblin_king: boss('goblin_king', { name: 'Gnasher, the Goblin King', hp: 280, dmg: [11, 18], sheet: 'goblin', scale: 1.7, tint: 0xf0d070, loot: { flint: 6, hide: 4, iron: 2 },
    kit: { roar: 'Gnasher bangs his crown on his throne: "MINE! All of it MINE!"', enrage: 'The Goblin King foams and bites his own shield!', summon: { kind: 'pink_gremlin', count: 3, text: 'Gnasher whistles: gremlins pour out of the walls!' } } }),
  grub_mother: boss('grub_mother', { name: 'The Grub Mother', hp: 320, dmg: [10, 16], sheet: 'slime', scale: 2.6, tint: 0xd8c890, nature: 'beast', loot: { hide: 6, meat: 6 },
    kit: { roar: 'Something pale and enormous shifts in the deepest burrow.', enrage: 'The Grub Mother bursts, spilling her brood!', area: { every: 3, targets: 2, name: 'spits acid', fx: 'acid' }, summon: { kind: 'giant_rat', count: 3, text: 'Her brood wriggles out to defend her!' } } }),
  // the flooded temples
  drowned_priestess: boss('drowned_priestess', { name: 'The Drowned Priestess', hp: 420, dmg: [13, 20], ranged: true, sheet: 'squidman', height: 80, tint: 0x70d0c0, loot: { cloth: 6, glass: 3 },
    kit: { roar: 'The Priestess rises from the flooded altar, still praying to the deep.', enrage: 'The temple floods: the Priestess sings, and the water answers!', area: { every: 3, targets: 3, name: 'calls up the tide', fx: 'frost' } } }),
  old_snapjaw: boss('old_snapjaw', { name: 'Old Snapjaw', hp: 480, dmg: [16, 24], sheet: 'crocodiles', scale: 1.4, tint: 0x90b070, nature: 'beast', armor: 0.2, loot: { hide: 10, meat: 8 },
    kit: { roar: 'The water at the temple\'s heart swells, and Old Snapjaw surfaces.', enrage: 'Snapjaw rolls and thrashes, dragging at anything in reach!' } }),
  sea_hag: boss('sea_hag', { name: 'The Sea Hag', hp: 380, dmg: [12, 19], ranged: true, sheet: 'ghosts', block: 1, scale: 1.8, look: { hue: 120 }, nature: 'undead', loot: { herbs: 6, cloth: 4 },
    kit: { roar: 'A cackle echoes over the black water. The Sea Hag has guests.', enrage: 'The Hag shrieks, and the drowned rise with her!', summon: { kind: 'skeleton_warrior', count: 2, text: 'Drowned sailors climb out of the water!' } } }),
  // the deep mines
  delvers_bane: boss('delvers_bane', { name: "The Delvers' Bane", hp: 600, dmg: [16, 25], sheet: 'golems', block: 1, scale: 2.4, tint: 0x9a8a7a, armor: 0.35, loot: { stone: 12, iron_ore: 8, rare_minerals: 1 },
    kit: { roar: 'The gallery wall moves. It was never a wall.', enrage: 'Cracks of firelight split the golem: it grinds on, faster!', area: { every: 4, targets: 3, name: 'brings the roof down', fx: 'quake' } } }),
  cave_troll: boss('cave_troll', { name: 'The Cave Troll', hp: 540, dmg: [17, 26], sheet: 'forest_boss_2', height: 86, look: { grey: true, bright: 0.95 }, nature: 'beast', loot: { hide: 8, bone: 6 },
    kit: { roar: 'Something huge sniffs the air: "Smells like supper."', enrage: 'The Troll tears a pit-prop free and swings it!', area: { every: 3, targets: 2, name: 'swings a mine timber', fx: 'quake' } } }),
  // the wizards' towers
  archmage_malakar: boss('archmage_malakar', { name: 'Archmage Malakar', hp: 460, dmg: [15, 23], ranged: true, sheet: 'wanderer_mage', height: 76, look: { hue: 260 }, loot: { glass: 4, herbs: 6, rare_minerals: 2 },
    kit: { roar: '"Students? No. Specimens," says the Archmage, closing his book.', enrage: 'Malakar\'s robes burn with stolen stars!', area: { every: 3, targets: 3, name: 'hurls a storm of arcane bolts', fx: 'beam' } } }),
  storm_lord: boss('storm_lord', { name: 'The Storm Lord', hp: 500, dmg: [16, 24], ranged: true, sheet: 'lightning_mage', height: 78, look: { hue: 200 }, loot: { glass: 6, iron: 4 },
    kit: { roar: 'Thunder in a closed room. The Storm Lord turns from his window.', enrage: 'The tower crackles: every window flashes white!', area: { every: 3, targets: 4, name: 'calls down lightning', fx: 'beam' } } }),
  grand_grimoire: boss('grand_grimoire', { name: 'The Hollow Librarian', hp: 420, dmg: [13, 20], ranged: true, sheet: 'wanderer_mage', height: 80, look: { hue: 40, bright: 0.85 }, loot: { cloth: 6, herbs: 4 },
    kit: { roar: 'A figure of dust and ink rises from the reading desk. "Overdue," it whispers.', enrage: 'The Librarian tears pages from itself and flings them like knives!', summon: { kind: 'possessed_tome', count: 2, text: 'Books flap down from the shelves at its call!' } } }),
  // the fey hollows
  erl_king: boss('erl_king', { name: 'The Erl-King', hp: 460, dmg: [14, 22], sheet: 'satyr_3', height: 90, look: { hue: 90 }, loot: { herbs: 8, cloth: 4, rare_minerals: 1 },
    kit: { roar: 'Antlers in the dark, and a voice like wind: "Stay. Stay forever."', enrage: 'The Erl-King\'s glamour falls away: he is all thorns and teeth!', area: { every: 3, targets: 3, name: 'whirls a gale of leaves', fx: 'acid' } } }),
  moth_queen: boss('moth_queen', { name: 'The Moth Queen', hp: 380, dmg: [12, 18], ranged: true, sheet: 'bats', scale: 2.2, tint: 0xf0f0d0, nature: 'beast', loot: { fiber: 8, cloth: 4 },
    kit: { roar: 'The lanterns gutter as a thousand wings rise.', enrage: 'The Moth Queen shakes dust from her wings: it burns!', summon: { kind: 'vampire_bat', count: 3, text: 'Her swarm descends!' } } }),
  // the spider nests
  brood_mother: boss('brood_mother', { name: 'Arachnis, the Brood Mother', hp: 480, dmg: [15, 23], sheet: 'horror', scale: 1.6, tint: 0x9070b0, nature: 'beast', loot: { fiber: 10, hide: 4 },
    kit: { roar: 'Webs tremble from wall to wall. Arachnis is coming down.', enrage: 'The Brood Mother rears and sprays her venom!', area: { every: 3, targets: 3, name: 'sprays venom', fx: 'acid' }, summon: { kind: 'giant_rat', count: 2, text: 'Her cocooned larders twitch and burst!' } } }),
  ooze_mother: boss('ooze_mother', { name: 'The Ooze Mother', hp: 420, dmg: [12, 19], sheet: 'hk_slime_purple', height: 74, nature: 'beast', loot: { clay: 8, herbs: 4 },
    kit: { roar: 'The floor of the nest is alive, and hungry.', enrage: 'The Ooze Mother splits, and splits again!', area: { every: 3, targets: 3, name: 'engulfs the front rank', fx: 'acid' } } }),
  // the sunken ships
  bosun_grimbones: boss('bosun_grimbones', { name: 'Bosun Grimbones', hp: 440, dmg: [14, 21], sheet: 'pirate_zombie', height: 78, tint: 0xc0d0a0, nature: 'undead', loot: { cloth: 6, iron: 4 },
    kit: { roar: '"All hands!" croaks the Bosun, and the dead crew stand to.', enrage: 'Grimbones rips the anchor chain free and whirls it!', summon: { kind: 'skeleton_warrior', count: 2, text: 'The drowned crew answer the whistle!' } } }),
  krakens_spawn: boss('krakens_spawn', { name: "The Kraken's Spawn", hp: 520, dmg: [15, 24], sheet: 'squidman', height: 92, tint: 0x8060c0, nature: 'beast', loot: { leather: 6, cloth: 4 },
    kit: { roar: 'Tentacles curl through the hold\'s broken planks.', enrage: 'Ink floods the hold: something lashes out of the black!', area: { every: 3, targets: 3, name: 'lashes with its tentacles', fx: 'shell' } } }),
  // the ice caves
  yeti_king: boss('yeti_king', { name: 'The Yeti King', hp: 520, dmg: [16, 25], sheet: 'snowmonkey', block: 1, scale: 2.6, look: { grey: true, bright: 1.6 }, nature: 'beast', loot: { hide: 10, meat: 6 },
    kit: { roar: 'A roar shakes icicles loose from the cave roof.', enrage: 'The Yeti King beats his chest: the cave groans!', area: { every: 3, targets: 3, name: 'brings down the icicles', fx: 'frost' } } }),
  rimewyrm: boss('rimewyrm', { name: 'The Rimewyrm', hp: 700, dmg: [18, 28], ranged: true, sheet: 'wyvern', scale: 1.1, look: { hue: 190 }, nature: 'beast', loot: { hide: 8, bone: 10, glass: 2 },
    kit: { roar: 'Blue scales in the ice. The Rimewyrm uncoils.', enrage: 'The Rimewyrm\'s breath turns the air to knives!', area: { every: 3, targets: 4, name: 'breathes hoarfrost', fx: 'frost' } } }),
  // the volcanic forges
  forge_lord: boss('forge_lord', { name: 'The Forge Lord', hp: 680, dmg: [18, 27], sheet: 'devil_leader', height: 92, look: { hue: 25 }, armor: 0.2, loot: { iron: 8, coal: 10, steel: 2 },
    kit: { roar: 'The Forge Lord sets down his hammer, and picks up another.', enrage: 'The Forge Lord plunges his arms in the lava and swings them burning!', area: { every: 3, targets: 3, name: 'pours molten iron', fx: 'fire' } } }),
  magma_golem: boss('magma_golem', { name: 'The Magma Golem', hp: 720, dmg: [17, 26], sheet: 'golems2', block: 1, scale: 2.6, tint: 0xff8040, armor: 0.3, loot: { stone: 10, coal: 8, rare_minerals: 1 },
    kit: { roar: 'The lava pool stands up.', enrage: 'Cracks glow white in the Magma Golem: it\'s going to burst!', area: { every: 3, targets: 3, name: 'erupts', fx: 'fire' } } }),
  salamander: boss('salamander', { name: 'The Great Salamander', hp: 600, dmg: [16, 24], ranged: true, sheet: 'drakes', block: 1, scale: 2.4, tint: 0xff6040, nature: 'beast', loot: { hide: 8, coal: 6 },
    kit: { roar: 'Something swims through the lava toward the party.', enrage: 'The Salamander\'s skin bursts into flame!', area: { every: 3, targets: 3, name: 'spits fire', fx: 'fire' } } }),
  // the machine vaults
  vault_warden: boss('vault_warden', { name: 'The Vault Warden', hp: 950, dmg: [20, 30], ranged: true, sheet: 'robot_destroyer', height: 88, look: { hue: 200 }, nature: 'machine', armor: 0.3, loot: { electronics: 6, alloys: 3, steel: 6 },
    kit: { roar: 'INTRUDERS DETECTED. VAULT PROTOCOL ENGAGED.', enrage: 'WARDEN DAMAGED. ALL WEAPONS FREE.', area: { every: 3, targets: 4, name: 'sweeps the vault with a laser', fx: 'beam' }, summon: { kind: 'infantry_bot', count: 2, text: 'Bay doors open: infantry bots march out!' } } }),
  prime_core: boss('prime_core', { name: 'The Prime Core', hp: 880, dmg: [19, 28], ranged: true, sheet: 'robot_infantry', height: 74, tint: 0xffd060, nature: 'machine', armor: 0.25, loot: { circuits: 4, electronics: 6, power_cells: 4 },
    kit: { roar: 'Every screen in the vault turns to show the party\'s faces.', enrage: 'The Prime Core overclocks: its casing glows red!', area: { every: 3, targets: 3, name: 'fires a missile salvo', fx: 'shell' } } }),
  // the dragons' dens
  ashen_wyrm: boss('ashen_wyrm', { name: 'The Ashen Wyrm', hp: 900, dmg: [19, 29], ranged: true, sheet: 'wyvern', scale: 1.15, look: { grey: true }, nature: 'beast', loot: { hide: 10, bone: 14, rare_minerals: 2 },
    kit: { roar: 'The ash heap breathes. It was never ash.', enrage: 'The Ashen Wyrm rises, and the den fills with cinders!', area: { every: 3, targets: 4, name: 'breathes a storm of cinders', fx: 'fire' }, summon: { kind: 'drake', count: 2, text: 'Its brood scrambles up from the embers!' } } }),
  twin_drakes: boss('twin_drakes', { name: 'The Elder Drake', hp: 760, dmg: [18, 27], ranged: true, sheet: 'drakes', block: 1, scale: 2.6, look: { hue: 30 }, nature: 'beast', loot: { hide: 8, bone: 8 },
    kit: { roar: 'An old drake lifts its head from a bed of coins.', enrage: 'The Elder Drake takes wing inside its own den!', area: { every: 3, targets: 3, name: 'breathes fire', fx: 'fire' }, summon: { kind: 'drake', count: 1, text: 'Its mate answers from the dark!' } } }),
};
