// Skills (abilities, to keep them apart from the work skills of data/skills.ts): two hundred of them, ten any class
// learns and the rest each class's own, learned as their people level. A passive skill is always at work (a little
// more health, a counter-blow, a chance to strike true); an active one is used in a fight when it's ready and worth it
// (sim/actions.ts), then waits out its cooldown.

import type { ClassId } from './classes';
import { cleanse, drain, grant, heal, hit, inflict, summon, useOf, type Effect, type Use } from './effects';

/** What a passive skill adds: shares (damage 0.1: a tenth more) or chances (counter 0.2: one blow in five). */
export interface Passive {
  hp?: number;
  damage?: number;
  accuracy?: number;
  dodge?: number;
  armor?: number;
  block?: number;
  crit?: number;
  /** A true strike does this much more than double. */
  critDamage?: number;
  /** Time between actions (a share less: quicker). */
  speed?: number;
  power?: number;
  healing?: number;
  /** Chance to strike back when struck in melee. */
  counter?: number;
  /** Share of damage dealt healed. */
  lifesteal?: number;
  /** Share of damage taken returned to the striker. */
  thorns?: number;
  /** Chance to take a blow meant for a hurt friend. */
  guard?: number;
  /** Chance to shrug off an ill status. */
  resist?: number;
  /** Health back each second, as a share of the most. */
  regen?: number;
  /** Below a quarter of their health: this much more damage. */
  lastStand?: number;
  /** Acts first in a fight. */
  firstStrike?: boolean;
  /** Extra damage against beasts, the dead, machines (shares). */
  beast?: number;
  undead?: number;
  machine?: number;
  pierce?: number;
  cleave?: number;
  stun?: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  cls: ClassId | null;
  level: number;
  passive?: Passive;
  active?: { cooldown: number; effects: readonly Effect[] };
  use: Use | 'passive';
}

type Row = [string, string, number, Passive | [number, Effect[]]];
const P = (p: Passive) => p;
const A = (cooldown: number, effects: Effect[]): [number, Effect[]] => [cooldown, effects];

const LISTS: [ClassId | null, Row[]][] = [
  [
    null,
    [
      ['first_aid', 'First Aid', 1, A(25, [heal(0.8, 'self')])],
      ['toughness', 'Toughness', 3, P({ hp: 0.08 })],
      ['battle_cry', 'Battle Cry', 5, A(35, [grant('inspired', 8, 'allies')])],
      ['keen_eye', 'Keen Eye', 7, P({ accuracy: 0.04 })],
      ['quick_feet', 'Quick Feet', 10, P({ dodge: 0.03 })],
      ['iron_will', 'Iron Will', 14, P({ resist: 0.2 })],
      ['veteran', 'Veteran', 20, P({ damage: 0.06, power: 0.06 })],
      ['second_wind', 'Second Wind', 24, A(60, [heal(1.5, 'self')])],
      ['endurance', 'Endurance', 28, P({ hp: 0.1 })],
      ['survivor', 'Survivor', 35, P({ lastStand: 0.25, resist: 0.1 })],
    ],
  ],
  [
    'knight',
    [
      ['shield_bash', 'Shield Bash', 1, A(10, [hit(1.1), inflict('stun', 2, 'foe', 0.4)])],
      ['shield_training', 'Shield Training', 3, P({ block: 0.06 })],
      ['provoke', 'Provoke', 6, A(20, [grant('taunt', 8)])],
      ['cover', 'Cover', 9, P({ guard: 0.3 })],
      ['valiant_charge', 'Valiant Charge', 15, A(14, [hit(1.6)])],
      ['plate_mastery', 'Plate Mastery', 21, P({ armor: 0.06 })],
      ['rallying_banner', 'Rallying Banner', 30, A(40, [grant('inspired', 10, 'allies'), grant('protect', 10, 'allies')])],
      ['unbreakable', 'Unbreakable', 40, P({ hp: 0.15, resist: 0.25 })],
    ],
  ],
  [
    'warrior',
    [
      ['power_strike', 'Power Strike', 1, A(8, [hit(1.5)])],
      ['brawn', 'Brawn', 3, P({ damage: 0.08 })],
      ['cleave', 'Cleave', 6, A(10, [hit(0.9, 'physical', 'foes')])],
      ['berserk', 'Berserk', 10, A(35, [grant('berserk', 10)])],
      ['bloodlust', 'Bloodlust', 16, P({ lastStand: 0.35 })],
      ['whirlwind', 'Whirlwind', 22, A(18, [hit(1.3, 'physical', 'foes')])],
      ['war_cry', 'War Cry', 30, A(40, [inflict('fear', 5, 'foes', 0.5), grant('inspired', 8, 'allies')])],
      ['titans_grip', "Titan's Grip", 42, P({ damage: 0.15, cleave: 0.2 })],
    ],
  ],
  [
    'ranger',
    [
      ['aimed_shot', 'Aimed Shot', 1, A(8, [hit(1.5)])],
      ['tracker', 'Tracker', 3, P({ beast: 0.2 })],
      ['twin_shot', 'Twin Shot', 6, A(10, [hit(0.8, 'physical', 'foe', 2)])],
      ['camouflage', 'Camouflage', 10, A(30, [grant('invisible', 5)])],
      ['wild_volley', 'Wild Volley', 16, A(16, [hit(0.7, 'physical', 'random_foes', 4)])],
      ['pathfinder', 'Pathfinder', 22, P({ dodge: 0.05, speed: 0.06 })],
      ['poison_arrow', 'Poison Arrow', 30, A(14, [hit(1), inflict('poison', 8, 'foe', 1, 4)])],
      ['wardens_wrath', "Warden's Wrath", 42, A(40, [hit(2.5, 'nature', 'foes')])],
    ],
  ],
  [
    'archer',
    [
      ['steady_aim', 'Steady Aim', 1, P({ accuracy: 0.05 })],
      ['piercing_shot', 'Piercing Shot', 3, A(10, [hit(1.4)])],
      ['rapid_fire', 'Rapid Fire', 7, A(14, [hit(0.6, 'physical', 'foe', 4)])],
      ['eagle_eye', 'Eagle Eye', 12, P({ crit: 0.06 })],
      ['arrow_rain', 'Arrow Rain', 18, A(20, [hit(1, 'physical', 'foes')])],
      ['crippling_shot', 'Crippling Shot', 24, A(14, [hit(1.1), inflict('slow', 6)])],
      ['deadeye', 'Deadeye', 33, P({ critDamage: 0.5, pierce: 0.2 })],
      ['hawkeye_volley', 'Hawkeye Volley', 44, A(40, [hit(1.6, 'physical', 'foes', 2)])],
    ],
  ],
  [
    'beast_tamer',
    [
      ['beast_bond', 'Beast Bond', 1, P({ hp: 0.05 })],
      ['whip_crack', 'Whip Crack', 3, A(10, [hit(1), inflict('stun', 2, 'foe', 0.3)])],
      ['soothe_beast', 'Soothe Beast', 7, A(25, [inflict('charm', 6, 'foe')])],
      ['pack_tactics', 'Pack Tactics', 12, P({ damage: 0.08, beast: 0.2 })],
      ['feral_howl', 'Feral Howl', 18, A(30, [grant('inspired', 8, 'allies'), grant('haste', 6, 'allies')])],
      ['wild_heart', 'Wild Heart', 25, P({ regen: 0.01, resist: 0.15 })],
      ['stampede', 'Stampede', 34, A(35, [hit(1.6, 'physical', 'foes'), inflict('stun', 2, 'foes', 0.3)])],
      ['lord_of_beasts', 'Lord of Beasts', 45, A(70, [summon('behemoth')])],
    ],
  ],
  [
    'mage',
    [
      ['arcane_mind', 'Arcane Mind', 1, P({ power: 0.08 })],
      ['staff_strike', 'Staff Strike', 3, A(8, [hit(1.1), inflict('stun', 1, 'foe', 0.2)])],
      ['focus', 'Focus', 8, A(30, [grant('focus', 10)])],
      ['elemental_mastery', 'Elemental Mastery', 15, P({ power: 0.12 })],
      ['blink', 'Blink', 22, A(30, [grant('invisible', 4)])],
      ['spell_surge', 'Spell Surge', 32, P({ crit: 0.1, critDamage: 0.3 })],
      ['archmage_presence', "Archmage's Presence", 42, P({ power: 0.15, resist: 0.15 })],
    ],
  ],
  [
    'witch',
    [
      ['crone_lore', 'Crone Lore', 1, P({ power: 0.06 })],
      ['familiar', 'Familiar', 5, A(40, [summon('vampire_bat')])],
      ['malice', 'Malice', 10, P({ stun: 0.05, power: 0.05 })],
      ['brew_master', 'Brew Master', 16, P({ healing: 0.15 })],
      ['shadow_step', 'Shadow Step', 23, A(30, [grant('invisible', 5)])],
      ['coven_pact', 'Coven Pact', 32, A(40, [grant('focus', 10, 'allies')])],
      ['hexmastery', 'Hexmastery', 42, P({ power: 0.15, lifesteal: 0.1 })],
    ],
  ],
  [
    'white_mage',
    [
      ['devotion', 'Devotion', 1, P({ healing: 0.1 })],
      ['mace_of_faith', 'Mace of Faith', 3, A(8, [hit(1.1, 'holy')])],
      ['blessing', 'Blessing', 9, A(30, [grant('inspired', 8, 'allies')])],
      ['aura_of_mercy', 'Aura of Mercy', 16, P({ healing: 0.15, regen: 0.005 })],
      ['turn_undead', 'Turn Undead', 24, A(25, [hit(2, 'holy', 'foes'), inflict('fear', 4, 'foes', 0.6)])],
      ['martyr', 'Martyr', 33, P({ guard: 0.3, hp: 0.1 })],
      ['saintly_grace', 'Saintly Grace', 44, P({ healing: 0.25, resist: 0.3 })],
    ],
  ],
  [
    'monk',
    [
      ['flurry', 'Flurry', 1, A(8, [hit(0.5, 'physical', 'foe', 3)])],
      ['meditation', 'Meditation', 3, P({ regen: 0.008 })],
      ['deflect', 'Deflect', 6, P({ dodge: 0.05, counter: 0.1 })],
      ['pressure_point', 'Pressure Point', 11, A(14, [hit(1.2), inflict('stun', 2, 'foe', 0.5)])],
      ['iron_fist', 'Iron Fist', 17, P({ damage: 0.12, pierce: 0.2 })],
      ['hundred_fists', 'Hundred Fists', 24, A(20, [hit(0.4, 'physical', 'foe', 8)])],
      ['empty_mind', 'Empty Mind', 32, P({ resist: 0.3, dodge: 0.05 })],
      ['dragon_kick', 'Dragon Kick', 42, A(30, [hit(3), inflict('stun', 3, 'foe', 0.6)])],
    ],
  ],
  [
    'assassin',
    [
      ['backstab', 'Backstab', 1, A(10, [hit(1.8)])],
      ['light_fingers', 'Light Fingers', 3, P({ dodge: 0.04 })],
      ['poison_blade', 'Poison Blade', 6, A(12, [hit(0.8), inflict('poison', 10, 'foe', 1, 3)])],
      ['vanish', 'Vanish', 10, A(30, [grant('invisible', 5)])],
      ['lethality', 'Lethality', 16, P({ crit: 0.08, critDamage: 0.4 })],
      ['fan_of_knives', 'Fan of Knives', 22, A(16, [hit(0.8, 'physical', 'foes')])],
      ['shadow_dance', 'Shadow Dance', 31, A(30, [grant('haste', 6), grant('invisible', 3)])],
      ['assassinate', 'Assassinate', 42, A(40, [hit(4.5)])],
    ],
  ],
  [
    'necromancer',
    [
      ['grave_lore', 'Grave Lore', 1, P({ power: 0.06 })],
      ['corpse_eater', 'Corpse Eater', 5, P({ lifesteal: 0.08 })],
      ['dark_pact', 'Dark Pact', 11, A(30, [grant('focus', 10)])],
      ['bone_wall', 'Bone Wall', 17, A(35, [grant('shield', 10, 'allies', 1)])],
      ['unholy_vigour', 'Unholy Vigour', 25, P({ hp: 0.1, regen: 0.006 })],
      ['master_of_death', 'Master of Death', 34, P({ power: 0.15 })],
      ['deathless', 'Deathless', 45, P({ lastStand: 0.4, resist: 0.25 })],
    ],
  ],
  [
    'summoner',
    [
      ['binder', 'Binder', 1, P({ power: 0.06 })],
      ['empower_summons', 'Empower Summons', 7, A(30, [grant('inspired', 10, 'allies')])],
      ['spirit_ward', 'Spirit Ward', 13, P({ resist: 0.15, dodge: 0.03 })],
      ['twin_bond', 'Twin Bond', 20, A(45, [summon('spirit')])],
      ['soul_siphon', 'Soul Siphon', 28, A(16, [drain(1.3, 'arcane')])],
      ['eternal_pact', 'Eternal Pact', 37, P({ power: 0.12, hp: 0.1 })],
      ['planeswalk', 'Planeswalk', 46, A(60, [grant('invisible', 4, 'allies'), grant('haste', 8, 'allies')])],
    ],
  ],
  [
    'blood_knight',
    [
      ['blood_oath', 'Blood Oath', 1, P({ lifesteal: 0.15 })],
      ['rending_blow', 'Rending Blow', 3, A(10, [hit(1.2), inflict('bleed', 8, 'foe', 1, 3)])],
      ['fury', 'Fury', 8, P({ lastStand: 0.3 })],
      ['crimson_charge', 'Crimson Charge', 14, A(16, [hit(1.7, 'blood')])],
      ['blood_frenzy', 'Blood Frenzy', 22, A(35, [grant('berserk', 10), grant('lifelink', 10)])],
      ['vampiric_aura', 'Vampiric Aura', 32, P({ lifesteal: 0.1, regen: 0.005 })],
      ['sanguine_king', 'Crown of Blood', 44, P({ damage: 0.2, lifesteal: 0.1 })],
    ],
  ],
  [
    'bard',
    [
      ['charisma', 'Charisma', 1, P({ power: 0.05 })],
      ['cutting_words', 'Cutting Words', 3, A(10, [hit(1, 'sound'), inflict('weak', 5, 'foe', 0.4)])],
      ['encore', 'Encore', 8, P({ speed: 0.06 })],
      ['dirge', 'Dirge', 14, A(20, [inflict('slow', 6, 'foes')])],
      ['inspiring_presence', 'Inspiring Presence', 20, P({ healing: 0.1, power: 0.08 })],
      ['countersong', 'Countersong', 28, A(30, [cleanse('allies')])],
      ['virtuoso', 'Virtuoso', 37, P({ power: 0.15, dodge: 0.04 })],
      ['magnum_opus', 'Magnum Opus', 47, A(70, [grant('haste', 8, 'allies'), grant('inspired', 8, 'allies'), heal(1, 'allies')])],
    ],
  ],
  [
    'druid',
    [
      ['green_thumb', 'Green Thumb', 1, P({ healing: 0.08 })],
      ['sickle_sweep', 'Sickle Sweep', 3, A(10, [hit(0.8, 'physical', 'foes')])],
      ['natures_ward', "Nature's Ward", 9, P({ resist: 0.15, regen: 0.004 })],
      ['wolf_shape', 'Shape of the Wolf', 16, A(30, [grant('haste', 10), grant('berserk', 6)])],
      ['symbiosis', 'Symbiosis', 24, P({ healing: 0.12, power: 0.08 })],
      ['thornmail', 'Thornmail', 33, P({ thorns: 0.25 })],
      ['avatar_of_the_wild', 'Avatar of the Wild', 44, A(60, [grant('protect', 12), grant('regen', 12, 'self', 2), grant('berserk', 12)])],
    ],
  ],
  [
    'alchemist',
    [
      ['steady_hands', 'Steady Hands', 1, P({ accuracy: 0.05 })],
      ['tonic', 'Tonic', 3, A(18, [heal(0.7, 'ally'), cleanse('ally')])],
      ['volatile_mix', 'Volatile Mix', 7, P({ power: 0.1 })],
      ['caltrops', 'Caltrops', 12, A(20, [inflict('slow', 6, 'foes'), inflict('bleed', 6, 'foes', 0.5, 2)])],
      ['bombardier', 'Bombardier', 18, P({ cleave: 0.25 })],
      ['transmute', 'Transmute', 26, A(30, [inflict('weak', 8, 'foes'), inflict('vulnerable', 8, 'foes')])],
      ['catalyst', 'Catalyst', 35, P({ power: 0.15, healing: 0.15 })],
      ['grand_elixir', 'Grand Elixir', 46, A(70, [heal(2, 'allies'), cleanse('allies'), grant('haste', 8, 'allies')])],
    ],
  ],
  [
    'engineer',
    [
      ['tinkerer', 'Tinkerer', 1, P({ armor: 0.03 })],
      ['quick_repair', 'Quick Repair', 3, A(20, [grant('shield', 8, 'ally', 1)])],
      ['deploy_turret', 'Deploy Turret', 7, A(45, [summon('iron_sentry')])],
      ['overcharge', 'Overcharge', 12, A(20, [hit(1.6, 'lightning')])],
      ['scrap_armour', 'Scrap Armour', 18, P({ armor: 0.05, hp: 0.06 })],
      ['flashbang', 'Flashbang', 25, A(25, [inflict('blind', 5, 'foes'), inflict('stun', 1, 'foes', 0.4)])],
      ['drone_swarm', 'Drone Swarm', 34, A(50, [summon('combat_drone'), summon('scout_drone')])],
      ['machinist', 'Machinist', 45, P({ damage: 0.15, machine: 0.3, pierce: 0.2 })],
    ],
  ],
  [
    'dragoon',
    [
      ['jump', 'Jump', 1, A(12, [hit(1.8)])],
      ['spear_mastery', 'Spear Mastery', 3, P({ damage: 0.06, pierce: 0.1 })],
      ['lance_charge', 'Lance Charge', 7, A(14, [hit(1.4), inflict('stun', 2, 'foe', 0.3)])],
      ['high_jump', 'High Jump', 13, A(18, [hit(2.4)])],
      ['dragon_skin', 'Dragon Skin', 20, P({ armor: 0.05, resist: 0.15 })],
      ['skewer', 'Skewer', 27, A(16, [hit(1.1, 'physical', 'foes')])],
      ['wyvern_strike', 'Wyvern Strike', 36, P({ crit: 0.08, critDamage: 0.4 })],
      ['dragon_dive', 'Dragon Dive', 46, A(45, [hit(2.6, 'fire', 'foes')])],
    ],
  ],
  [
    'samurai',
    [
      ['iaijutsu', 'Iaijutsu', 1, A(10, [hit(1.6)])],
      ['bushido', 'Bushido', 3, P({ crit: 0.05 })],
      ['parry', 'Parry', 7, P({ counter: 0.15, dodge: 0.03 })],
      ['zanshin', 'Zanshin', 12, P({ firstStrike: true, accuracy: 0.05 })],
      ['crescent_moon', 'Crescent Moon', 18, A(16, [hit(1.1, 'physical', 'foes')])],
      ['blade_dance', 'Blade Dance', 25, A(20, [hit(0.7, 'physical', 'random_foes', 4)])],
      ['meikyo_shisui', 'Meikyo Shisui', 34, P({ critDamage: 0.6, resist: 0.15 })],
      ['one_cut', 'One Cut', 45, A(45, [hit(5)])],
    ],
  ],
  [
    'guardian',
    [
      ['stalwart', 'Stalwart', 1, P({ hp: 0.1 })],
      ['shield_wall', 'Shield Wall', 3, A(20, [grant('protect', 8), grant('taunt', 8)])],
      ['bodyguard', 'Bodyguard', 7, P({ guard: 0.4 })],
      ['retaliate', 'Retaliate', 12, P({ counter: 0.2, thorns: 0.1 })],
      ['bulwark', 'Bulwark', 18, A(35, [grant('shield', 10, 'allies', 1.2)])],
      ['immovable', 'Immovable', 25, P({ armor: 0.06, resist: 0.2 })],
      ['last_bastion', 'Last Bastion', 34, A(60, [grant('protect', 10, 'allies'), grant('taunt', 10)])],
      ['aegis', 'Aegis', 45, P({ hp: 0.2, block: 0.1 })],
    ],
  ],
  [
    'shaman',
    [
      ['spirit_sight', 'Spirit Sight', 1, P({ power: 0.05, resist: 0.05 })],
      ['totem_strike', 'Totem Strike', 3, A(9, [hit(1.1), inflict('slow', 3, 'foe', 0.3)])],
      ['mojo', 'Mojo', 9, P({ healing: 0.1 })],
      ['spirit_wolves', 'Spirit Wolves', 16, A(40, [summon('companion_wolf'), summon('companion_wolf')])],
      ['ancestral_guidance', 'Ancestral Guidance', 24, P({ power: 0.1, healing: 0.1 })],
      ['purge', 'Purge', 32, A(25, [cleanse('allies')])],
      ['totem_lord', 'Totem Lord', 43, P({ regen: 0.008, power: 0.12 })],
    ],
  ],
  [
    'spellblade',
    [
      ['blade_and_spell', 'Blade and Spell', 1, P({ damage: 0.05, power: 0.05 })],
      ['riposte', 'Riposte', 5, P({ counter: 0.12 })],
      ['dual_cast', 'Dual Cast', 11, A(20, [hit(1, 'arcane', 'foe', 2)])],
      ['battle_magic', 'Battle Magic', 18, P({ power: 0.1, armor: 0.03 })],
      ['runeblade', 'Runeblade', 26, A(25, [hit(1.8, 'arcane'), drain(0.6, 'arcane')])],
      ['arcane_armour', 'Arcane Armour', 34, P({ resist: 0.2, hp: 0.08 })],
      ['spellstorm_blade', 'Spellstorm Blade', 45, A(45, [hit(1.5, 'lightning', 'foes'), hit(1.5, 'fire', 'foes')])],
    ],
  ],
  [
    'chronomancer',
    [
      ['foresight', 'Foresight', 1, P({ dodge: 0.04 })],
      ['quickened_mind', 'Quickened Mind', 6, P({ speed: 0.06 })],
      ['deja_vu', 'Deja Vu', 12, A(30, [grant('focus', 8, 'allies')])],
      ['borrowed_time', 'Borrowed Time', 19, P({ lastStand: 0.3, regen: 0.005 })],
      ['time_skip', 'Time Skip', 27, A(35, [grant('haste', 6, 'allies'), inflict('slow', 6, 'foes')])],
      ['paradox', 'Paradox', 36, P({ power: 0.15, resist: 0.2 })],
      ['eternity', 'Eternity', 46, P({ hp: 0.15, speed: 0.08 })],
    ],
  ],
  [
    'hunter',
    [
      ['snare', 'Snare', 1, A(14, [inflict('slow', 6), hit(0.6)])],
      ['big_game', 'Big Game', 3, P({ beast: 0.25 })],
      ['net', 'Net', 7, A(20, [inflict('stun', 3, 'foe', 0.7)])],
      ['monster_lore', 'Monster Lore', 12, P({ undead: 0.2, machine: 0.15 })],
      ['bear_trap', 'Bear Trap', 18, A(22, [hit(1.6), inflict('bleed', 8, 'foe', 1, 3)])],
      ['steady_hunter', 'Steady Hunter', 25, P({ crit: 0.06, accuracy: 0.04 })],
      ['explosive_shot', 'Explosive Shot', 33, A(22, [hit(1.4, 'fire', 'foes')])],
      ['monster_slayer', 'Monster Slayer', 44, P({ beast: 0.3, undead: 0.3, damage: 0.1 })],
    ],
  ],
  [
    'dancer',
    [
      ['graceful', 'Graceful', 1, P({ dodge: 0.05 })],
      ['twirl', 'Twirl', 3, A(9, [hit(0.7, 'physical', 'foe', 2)])],
      ['allure', 'Allure', 8, A(22, [inflict('charm', 4, 'foes', 0.3)])],
      ['tempo', 'Tempo', 13, P({ speed: 0.08 })],
      ['veil_dance', 'Veil Dance', 19, A(30, [grant('invisible', 4, 'self'), grant('haste', 6, 'allies')])],
      ['flourish', 'Flourish', 26, P({ crit: 0.08, counter: 0.1 })],
      ['mirage', 'Mirage', 35, P({ dodge: 0.08, resist: 0.15 })],
      ['last_dance', 'The Last Dance', 46, A(60, [hit(1.2, 'physical', 'foes', 2), grant('inspired', 10, 'allies')])],
    ],
  ],
];

export const ABILITIES: readonly AbilityDef[] = LISTS.flatMap(([cls, rows]) =>
  rows.map(([id, name, level, what]) =>
    Array.isArray(what) ? { id, name, cls, level, active: { cooldown: what[0], effects: what[1] }, use: useOf(what[1]) } : { id, name, cls, level, passive: what, use: 'passive' as const },
  ),
);
export const ABILITY_BY_ID: Readonly<Record<string, AbilityDef>> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

/** The skills someone of a class knows at a level: their class's, and the ten anyone learns. */
export const abilitiesKnown = (cls: ClassId | null | undefined, level: number): AbilityDef[] => ABILITIES.filter((a) => a.level <= level && (a.cls === null || a.cls === cls));
