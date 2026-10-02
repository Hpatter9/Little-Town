// The spell list: a hundred and sixty spells, a few for any caster and the rest each class's own, learned as their
// people level (data/levels.ts). A caster keeps three ready at a time (sim/actions.ts picks the best of what they
// know: one to strike, one to mend, one to help or hinder, as their class leans), each on its cooldown: the great
// spells on long ones, so they're cast sparingly.

import type { ClassId } from './classes';
import { cleanse, dispel, drain, grant, heal, hit, inflict, revive, summon, useOf, type Effect, type Use } from './effects';

export interface SpellDef {
  id: string;
  name: string;
  /** Its class, or null: any caster may learn it. */
  cls: ClassId | null;
  /** The level it's learned at. */
  level: number;
  /** Seconds before it can be cast again. */
  cooldown: number;
  effects: readonly Effect[];
  use: Use;
}

type Row = [string, string, number, number, Effect[]];

/** The classes that learn the spells any caster may (those with spell power to speak of). */
export const SPELLCASTERS: ReadonlySet<ClassId> = new Set<ClassId>(['mage', 'witch', 'white_mage', 'necromancer', 'summoner', 'druid', 'shaman', 'chronomancer', 'spellblade', 'bard', 'alchemist']);

const LISTS: [ClassId | null, Row[]][] = [
  [
    null,
    [
      ['spark', 'Spark', 1, 5, [hit(1, 'lightning')]],
      ['mend', 'Mend', 2, 7, [heal(1)]],
      ['ward', 'Ward', 5, 14, [grant('shield', 10, 'ally', 1)]],
      ['flash', 'Flash', 8, 16, [inflict('blind', 6)]],
      ['dispel_magic', 'Dispel Magic', 12, 18, [cleanse('ally')]],
      ['quicken', 'Quicken', 16, 20, [grant('haste', 8)]],
    ],
  ],
  [
    'mage',
    [
      ['fire_bolt', 'Fire Bolt', 1, 4, [hit(1.1, 'fire'), inflict('burn', 6, 'foe', 0.2, 2)]],
      ['frost_shard', 'Frost Shard', 3, 5, [hit(1, 'ice'), inflict('slow', 3, 'foe', 0.3)]],
      ['thunder_jolt', 'Thunder Jolt', 5, 6, [hit(1.2, 'lightning'), inflict('stun', 2, 'foe', 0.15)]],
      ['flame_wave', 'Flame Wave', 8, 10, [hit(0.8, 'fire', 'foes')]],
      ['ice_lance', 'Ice Lance', 11, 8, [hit(1.7, 'ice'), inflict('freeze', 4, 'foe', 0.2)]],
      ['chain_lightning', 'Chain Lightning', 14, 12, [hit(0.9, 'lightning', 'random_foes', 3)]],
      ['arcane_missiles', 'Arcane Missiles', 17, 9, [hit(0.5, 'arcane', 'foe', 5)]],
      ['blizzard', 'Blizzard', 21, 18, [hit(1.1, 'ice', 'foes'), inflict('slow', 5, 'foes')]],
      ['fireball', 'Fireball', 24, 16, [hit(1.6, 'fire', 'foes'), inflict('burn', 6, 'foes', 0.4, 3)]],
      ['thunderstorm', 'Thunderstorm', 28, 22, [hit(1.4, 'lightning', 'foes'), inflict('stun', 2, 'foes', 0.25)]],
      ['mana_shield', 'Mana Shield', 31, 30, [grant('shield', 12, 'self', 3)]],
      ['meteor', 'Meteor', 35, 30, [hit(2.6, 'fire', 'foes'), inflict('burn', 8, 'foes', 0.6, 4)]],
      ['arcane_torrent', 'Arcane Torrent', 39, 26, [hit(3.2, 'arcane')]],
      ['absolute_zero', 'Absolute Zero', 44, 40, [hit(2.4, 'ice', 'foes'), inflict('freeze', 5, 'foes', 0.5)]],
      ['cataclysm', 'Cataclysm', 49, 60, [hit(4, 'fire', 'foes'), hit(2, 'lightning', 'foes')]],
    ],
  ],
  [
    'witch',
    [
      ['hex_bolt', 'Hex Bolt', 1, 4, [hit(0.9, 'dark'), inflict('weak', 5, 'foe', 0.2)]],
      ['wither', 'Wither', 3, 8, [hit(0.5, 'dark'), inflict('weak', 8)]],
      ['poison_cloud', 'Poison Cloud', 6, 10, [inflict('poison', 8, 'foes', 1, 3)]],
      ['evil_eye', 'Evil Eye', 9, 12, [inflict('fear', 5)]],
      ['sleep_charm', 'Sleep Charm', 12, 14, [inflict('sleep', 6, 'foes', 0.5)]],
      ['blood_hex', 'Blood Hex', 16, 14, [inflict('vulnerable', 8), drain(0.6)]],
      ['witches_brew', "Witches' Brew", 20, 20, [heal(0.8, 'allies'), grant('regen', 8, 'allies', 0.5)]],
      ['nightshade', 'Nightshade', 24, 16, [hit(1.4, 'poison', 'foes'), inflict('poison', 8, 'foes', 0.7, 4)]],
      ['curse_of_ages', 'Curse of Ages', 29, 22, [inflict('slow', 10, 'foes'), inflict('weak', 10, 'foes')]],
      ['mirror_hex', 'Mirror Hex', 34, 28, [grant('reflect', 8, 'ally')]],
      ['doom_curse', 'Doom', 40, 45, [inflict('doom', 10)]],
      ['crone_call', "The Crone's Call", 47, 55, [summon('night_shade'), inflict('fear', 6, 'foes')]],
    ],
  ],
  [
    'white_mage',
    [
      ['cure', 'Cure', 1, 5, [heal(1.2)]],
      ['holy_light', 'Holy Light', 3, 6, [hit(1, 'holy')]],
      ['protect', 'Protect', 5, 16, [grant('protect', 12, 'ally')]],
      ['purify', 'Purify', 8, 12, [cleanse('ally')]],
      ['regen', 'Regen', 10, 14, [grant('regen', 12, 'weakest', 1.2)]],
      ['cura', 'Cura', 13, 10, [heal(1, 'allies')]],
      ['holy_shield', 'Holy Shield', 16, 20, [grant('shield', 10, 'weakest', 2)]],
      ['smite', 'Smite', 19, 12, [hit(1.8, 'holy')]],
      ['raise', 'Raise', 22, 40, [revive(0.4)]],
      ['sanctuary', 'Sanctuary', 26, 28, [grant('protect', 10, 'allies'), grant('regen', 10, 'allies', 0.6)]],
      ['curaga', 'Curaga', 30, 18, [heal(1.6, 'allies')]],
      ['banish', 'Banish', 34, 30, [hit(3, 'holy', 'foes')]],
      ['divine_ward', 'Divine Ward', 38, 40, [grant('shield', 10, 'allies', 2.5)]],
      ['arise', 'Arise', 43, 60, [revive(1), heal(1, 'allies')]],
      ['miracle', 'Miracle', 48, 70, [heal(3, 'allies'), cleanse('allies'), revive(0.6)]],
    ],
  ],
  [
    'necromancer',
    [
      ['bone_dart', 'Bone Dart', 1, 4, [hit(1, 'dark')]],
      ['life_tap', 'Life Tap', 3, 8, [drain(0.9)]],
      ['raise_dead', 'Raise Dead', 6, 30, [summon('grave_ghost')]],
      ['corpse_blast', 'Corpse Blast', 9, 14, [hit(1.2, 'dark', 'foes')]],
      ['plague', 'Plague', 12, 14, [inflict('poison', 10, 'foes', 1, 3), inflict('weak', 8, 'foes', 0.5)]],
      ['bone_armour', 'Bone Armour', 15, 25, [grant('shield', 12, 'self', 2.5)]],
      ['soul_rend', 'Soul Rend', 19, 12, [drain(1.5)]],
      ['terror', 'Terror', 23, 22, [inflict('fear', 6, 'foes', 0.6)]],
      ['wraith_call', 'Wraith Call', 27, 35, [summon('wraith')]],
      ['death_coil', 'Death Coil', 31, 18, [hit(2.4, 'dark')]],
      ['army_of_the_dead', 'Army of the Dead', 36, 60, [summon('zombie'), summon('zombie'), summon('flying_skull')]],
      ['finger_of_death', 'Finger of Death', 42, 45, [hit(4.5, 'dark')]],
      ['grave_lord', 'Grave Lord', 48, 80, [summon('abomination'), drain(1.5, 'dark', 'foes')]],
    ],
  ],
  [
    'summoner',
    [
      ['call_spirit', 'Call Spirit', 1, 25, [summon('spirit')]],
      ['spirit_bolt', 'Spirit Bolt', 2, 5, [hit(1, 'arcane')]],
      ['call_wolf', 'Call Wolf', 5, 30, [summon('companion_wolf')]],
      ['call_salamander', 'Call Salamander', 10, 35, [summon('fire_elemental')]],
      ['spirit_link', 'Spirit Link', 13, 20, [grant('lifelink', 10, 'allies')]],
      ['call_treant', 'Call Treant', 16, 40, [summon('treant')]],
      ['astral_blast', 'Astral Blast', 19, 12, [hit(1.5, 'arcane', 'foes')]],
      ['call_undine', 'Call Undine', 22, 40, [summon('coral_golem')]],
      ['call_golem', 'Call Golem', 26, 45, [summon('stone_golem')]],
      ['soul_barrier', 'Soul Barrier', 30, 30, [grant('shield', 10, 'allies', 1.5)]],
      ['call_drake', 'Call Drake', 35, 55, [summon('drake')]],
      ['planar_rift', 'Planar Rift', 41, 40, [hit(2.5, 'arcane', 'foes')]],
      ['convergence', 'Convergence', 47, 90, [summon('fire_elemental'), summon('coral_golem'), hit(2, 'arcane', 'foes')]],
    ],
  ],
  [
    'druid',
    [
      ['thorn', 'Thorn', 1, 4, [hit(1, 'nature')]],
      ['rejuvenate', 'Rejuvenate', 2, 10, [grant('regen', 10, 'weakest', 1)]],
      ['entangle', 'Entangle', 5, 12, [hit(0.4, 'nature', 'foes'), inflict('slow', 6, 'foes')]],
      ['moonbeam', 'Moonbeam', 8, 8, [hit(1.3, 'arcane')]],
      ['barkskin', 'Barkskin', 11, 18, [grant('protect', 12, 'ally')]],
      ['healing_rain', 'Healing Rain', 14, 18, [heal(0.9, 'allies'), grant('regen', 6, 'allies', 0.4)]],
      ['wild_growth', 'Wild Growth', 18, 20, [grant('regen', 12, 'allies', 1)]],
      ['insect_swarm', 'Insect Swarm', 21, 16, [inflict('poison', 8, 'foes', 1, 4), inflict('blind', 4, 'foes', 0.3)]],
      ['bear_shape', 'Shape of the Bear', 25, 40, [grant('berserk', 12), grant('protect', 12)]],
      ['call_lightning', 'Call Lightning', 29, 20, [hit(1.8, 'lightning', 'random_foes', 3)]],
      ['hurricane', 'Hurricane', 34, 30, [hit(1.6, 'wind', 'foes'), inflict('slow', 6, 'foes')]],
      ['tranquility', 'Tranquility', 40, 50, [heal(2.2, 'allies'), cleanse('allies')]],
      ['wrath_of_nature', 'Wrath of Nature', 46, 60, [hit(3, 'nature', 'foes'), inflict('stun', 3, 'foes', 0.4)]],
    ],
  ],
  [
    'shaman',
    [
      ['spirit_strike', 'Spirit Strike', 1, 4, [hit(1, 'arcane')]],
      ['healing_totem', 'Healing Totem', 3, 20, [grant('regen', 15, 'allies', 0.6)]],
      ['shock', 'Shock', 6, 8, [hit(1.3, 'lightning')]],
      ['hex_of_frailty', 'Hex of Frailty', 9, 12, [inflict('weak', 8), inflict('vulnerable', 8)]],
      ['spirit_walk', 'Spirit Walk', 12, 25, [grant('invisible', 6)]],
      ['earthbind', 'Earthbind', 15, 16, [inflict('slow', 8, 'foes')]],
      ['ancestral_call', 'Ancestral Call', 19, 40, [summon('spirit')]],
      ['chain_heal', 'Chain Heal', 23, 16, [heal(0.8, 'allies')]],
      ['voodoo_curse', 'Voodoo Curse', 27, 20, [drain(1.4)]],
      ['storm_totem', 'Storm Totem', 32, 30, [hit(1.7, 'lightning', 'random_foes', 4)]],
      ['spirit_link_totem', 'Spirit Link Totem', 38, 40, [grant('lifelink', 10, 'allies')]],
      ['ancestors_wrath', "Ancestors' Wrath", 45, 60, [hit(3, 'arcane', 'foes'), heal(1, 'allies')]],
    ],
  ],
  [
    'chronomancer',
    [
      ['time_bolt', 'Time Bolt', 1, 4, [hit(1, 'time')]],
      ['haste', 'Haste', 3, 14, [grant('haste', 8, 'ally')]],
      ['slow_spell', 'Slow', 5, 10, [inflict('slow', 8)]],
      ['rewind', 'Rewind', 8, 20, [heal(1.5)]],
      ['accelerate', 'Accelerate', 12, 22, [grant('haste', 8, 'allies')]],
      ['age', 'Age', 15, 14, [hit(1.4, 'time'), inflict('weak', 6)]],
      ['stasis', 'Stasis', 19, 24, [inflict('stop', 4)]],
      ['temporal_shield', 'Temporal Shield', 23, 28, [grant('shield', 10, 'allies', 1.5)]],
      ['time_loop', 'Time Loop', 28, 30, [hit(0.7, 'time', 'foe', 4)]],
      ['slowga', 'Slowga', 33, 28, [hit(0.8, 'time', 'foes'), inflict('slow', 8, 'foes')]],
      ['chronoshift', 'Chronoshift', 39, 50, [revive(0.6), grant('haste', 8, 'allies')]],
      ['time_stop', 'Time Stop', 45, 75, [inflict('stop', 6, 'foes')]],
    ],
  ],
  [
    'spellblade',
    [
      ['flame_blade', 'Flame Blade', 1, 8, [hit(1.2, 'fire'), inflict('burn', 5, 'foe', 0.3, 2)]],
      ['frost_edge', 'Frost Edge', 4, 8, [hit(1.1, 'ice'), inflict('slow', 4, 'foe', 0.4)]],
      ['shock_blade', 'Shock Blade', 8, 8, [hit(1.3, 'lightning'), inflict('stun', 2, 'foe', 0.2)]],
      ['arcane_shield', 'Arcane Shield', 12, 22, [grant('shield', 10, 'self', 1.5)]],
      ['blink_strike', 'Blink Strike', 17, 12, [hit(1.6, 'arcane')]],
      ['elemental_burst', 'Elemental Burst', 23, 18, [hit(1.2, 'fire', 'foes')]],
      ['spell_reflect', 'Spell Reflect', 30, 30, [grant('reflect', 8)]],
      ['arcane_cataclysm', 'Arcane Cataclysm', 40, 50, [hit(2.8, 'arcane', 'foes')]],
    ],
  ],
  [
    'knight',
    [
      ['lay_on_hands', 'Lay on Hands', 10, 40, [heal(2.5)]],
      ['holy_strike', 'Holy Strike', 14, 10, [hit(1.6, 'holy')]],
      ['divine_protection', 'Divine Protection', 20, 35, [grant('protect', 10, 'allies')]],
      ['consecrate', 'Consecrate', 26, 25, [hit(1.2, 'holy', 'foes')]],
      ['aura_of_valour', 'Aura of Valour', 32, 40, [grant('inspired', 12, 'allies')]],
      ['judgement', 'Judgement', 42, 45, [hit(3, 'holy')]],
    ],
  ],
  [
    'blood_knight',
    [
      ['blood_strike', 'Blood Strike', 5, 8, [drain(1.2, 'blood')]],
      ['crimson_pact', 'Crimson Pact', 10, 30, [grant('lifelink', 12)]],
      ['haemorrhage', 'Haemorrhage', 16, 14, [hit(0.6, 'blood'), inflict('bleed', 10, 'foe', 1, 4)]],
      ['blood_boil', 'Blood Boil', 24, 20, [hit(1.3, 'blood', 'foes')]],
      ['sanguine_shield', 'Sanguine Shield', 32, 35, [grant('shield', 10, 'self', 3)]],
      ['exsanguinate', 'Exsanguinate', 42, 50, [drain(3, 'blood', 'foes')]],
    ],
  ],
  [
    'bard',
    [
      ['ballad_of_valour', 'Ballad of Valour', 1, 20, [grant('inspired', 10, 'allies')]],
      ['lullaby', 'Lullaby', 4, 16, [inflict('sleep', 5, 'foes', 0.4)]],
      ['song_of_rest', 'Song of Rest', 8, 20, [heal(0.7, 'allies')]],
      ['quick_march', 'Quick March', 12, 24, [grant('haste', 8, 'allies')]],
      ['discord', 'Discord', 17, 16, [inflict('weak', 8, 'foes')]],
      ['shattering_note', 'Shattering Note', 22, 14, [hit(1.4, 'sound', 'foes')]],
      ['anthem_of_heroes', 'Anthem of Heroes', 30, 40, [grant('protect', 10, 'allies'), grant('inspired', 10, 'allies')]],
      ['requiem', 'Requiem', 40, 55, [hit(2.5, 'sound', 'foes'), inflict('fear', 5, 'foes', 0.5)]],
    ],
  ],
  [
    'dancer',
    [
      ['sword_dance', 'Sword Dance', 1, 12, [hit(0.6, 'physical', 'random_foes', 3)]],
      ['mesmerise', 'Mesmerise', 5, 16, [inflict('charm', 5)]],
      ['healing_waltz', 'Healing Waltz', 10, 20, [heal(0.6, 'allies')]],
      ['wind_step', 'Wind Step', 16, 22, [grant('haste', 8, 'allies')]],
      ['dance_of_death', 'Dance of Death', 36, 45, [hit(1, 'physical', 'random_foes', 6)]],
    ],
  ],
  [
    'ranger',
    [
      ['hunters_mark', "Hunter's Mark", 6, 14, [inflict('vulnerable', 10)]],
      ['natures_grace', "Nature's Grace", 12, 25, [heal(1, 'self')]],
      ['entangling_shot', 'Entangling Shot', 20, 16, [hit(1.2, 'nature'), inflict('slow', 5)]],
    ],
  ],
  [
    'monk',
    [
      ['inner_peace', 'Inner Peace', 6, 25, [heal(1.2, 'self')]],
      ['chi_blast', 'Chi Blast', 12, 10, [hit(1.4, 'arcane')]],
      ['diamond_body', 'Diamond Body', 22, 35, [grant('protect', 10), grant('thorns', 10, 'self', 0.4)]],
      ['transcendence', 'Transcendence', 40, 60, [grant('haste', 10), heal(1.5, 'self'), grant('focus', 10)]],
    ],
  ],
  [
    'beast_tamer',
    [
      ['call_companion', 'Call Companion', 1, 30, [summon('companion_wolf')]],
      ['wild_roar', 'Wild Roar', 12, 25, [inflict('fear', 5, 'foes', 0.4)]],
      ['call_the_pack', 'Call the Pack', 30, 50, [summon('companion_wolf'), summon('companion_wolf'), summon('lion')]],
    ],
  ],
  [
    'alchemist',
    [
      ['acid_flask', 'Acid Flask', 1, 6, [hit(1, 'poison'), inflict('vulnerable', 6, 'foe', 0.3)]],
      ['fire_flask', 'Fire Flask', 4, 8, [hit(0.9, 'fire', 'foes')]],
      ['healing_draught', 'Healing Draught', 7, 14, [heal(1.3)]],
      ['smoke_bomb', 'Smoke Bomb', 12, 20, [inflict('blind', 6, 'foes')]],
      ['elixir_of_vigour', 'Elixir of Vigour', 20, 30, [grant('regen', 12, 'allies', 1), grant('haste', 6, 'allies')]],
      ['philosophers_fire', "Philosopher's Fire", 38, 50, [hit(2.4, 'fire', 'foes'), inflict('burn', 8, 'foes', 0.6, 4), dispel('foes')]],
    ],
  ],
];

export const SPELLS: readonly SpellDef[] = LISTS.flatMap(([cls, rows]) => rows.map(([id, name, level, cooldown, effects]) => ({ id, name, cls, level, cooldown, effects, use: useOf(effects) })));
export const SPELL_BY_ID: Readonly<Record<string, SpellDef>> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

/** The spells someone of a class knows at a level: their class's, and the any-caster ones if they cast at all. */
export function spellsKnown(cls: ClassId | null | undefined, level: number): SpellDef[] {
  if (!cls) return [];
  return SPELLS.filter((s) => s.level <= level && (s.cls === cls || (s.cls === null && SPELLCASTERS.has(cls))));
}
