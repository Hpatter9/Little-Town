// How each spell looks (drawn by spellsView.ts): the kind of effect, and its colours. Kept apart from the drawing so
// the tests can check every power and rival spell has one.

/** How each spell looks: the kind of effect, and its colours. */
export type Kind = 'bolt' | 'stream' | 'roots' | 'rain' | 'fog' | 'ring' | 'rise' | 'arrows' | 'lob' | 'rocks' | 'vortex' | 'dome' | 'sparkle' | 'bats' | 'coins' | 'aura' | 'wave';
/** An animated sprite from the effect sheets (renderer/art/effects.ts), played over each target (or the caster). */
export type SheetFx =
  | 'blood' | 'vampire' | 'undead' | 'werewolf' | 'heal' | 'frost' | 'portal' | 'cast' | 'holy' | 'shock' | 'conjure' | 'acid'
  // (the spell sheets: pvfx-foundry and the Alenia Star Magic Pack)
  | 'roots' | 'rain' | 'leaves' | 'bloom' | 'venom_ward' | 'parry' | 'counterfall' | 'prism' | 'void' | 'moths' | 'suture' | 'charge'
  | 'splash' | 'foam' | 'hourglass' | 'mercury' | 'spines' | 'orchid' | 'missile'
  | 'blood_bubble' | 'blood_storm' | 'dark_flames' | 'gold_vortex' | 'life_fountain' | 'chaos_storm'
  // (Craftpix's magic strips and magic slashes)
  | 'mg_ground_fire' | 'mg_ground_fire2' | 'mg_sigil' | 'mg_beam' | 'mg_strike' | 'mg_bolt' | 'mg_bolt2' | 'mg_pop' | 'mg_sparks' | 'mg_flame' | 'mg_flare' | 'mg_spikes' | 'mg_creep' | 'mg_puff' | 'mg_shards'
  | 'slash_wind' | 'slash_fire' | 'slash_lightning' | 'slash_poison' | 'slash_gold' | 'slash_water';
/** An effect: one of the sheets above, or a strip of the pixel effects atlas (`px:<element>-<family>`: data/actFx.ts). */
export type SpriteFx = SheetFx | `px:${string}`;
export interface Look {
  kind: Kind;
  /** Played with it, from the effect sheets; `onCaster`: over the caster instead of the targets. */
  sprite?: SpriteFx;
  onCaster?: boolean;
  color: number;
  /** A second effect played with it (a raise with a pillar of light, a storm with its rain). */
  also?: Kind;
  alt?: number;
}

export const GREEN_DEAD = 0x7cf0a0;
export const BONE = 0xe8e0c8;
const BLOOD = 0xe03040;
const LEAF = 0x6ad048;
const RAIN = 0x9ad0f0;
const VIOLET = 0xb070ff;
const SILVER = 0xc8d8f0;
const CYAN = 0x60e0ff;
const GOLD = 0xf0c040;
const EMBER = 0xff9030;
const STONE = 0xa8a098;
const SEA = 0x40b0e0;
const PINK = 0xff80d0;
const ACID = 0x90f040;
const SAND = 0xd8c890;

export const LOOKS: Record<string, Look> = {
  // the gods' signs (sim/faith.ts)
  'god:bless': { sprite: 'holy', kind: 'sparkle', color: GOLD },
  'god:lightning': { sprite: 'shock', kind: 'bolt', color: 0xe8f0ff },
  'god:blight': { sprite: 'dark_flames', kind: 'fog', color: 0x6a5a20 },
  // natural disasters (sim/disasters.ts)
  'disaster:tornado': { sprite: 'chaos_storm', kind: 'vortex', color: 0x9aa0a8 },
  'disaster:dust': { sprite: 'spines', kind: 'fog', color: 0xa89878 },
  // the dragon's breath on a roof (sim/dragon.ts)
  'dragon:fire': { sprite: 'mg_ground_fire', kind: 'ring', color: 0xff7a2a },
  // the town's own powers
  'town:raise_dead': { sprite: 'conjure', kind: 'rise', color: GREEN_DEAD },
  'town:bone_ward': { sprite: 'parry', kind: 'dome', color: BONE },
  'town:drain_life': { sprite: 'void', kind: 'stream', color: GREEN_DEAD },
  'town:call_rain': { sprite: 'rain', kind: 'rain', color: RAIN },
  'town:entangle': { sprite: 'roots', kind: 'roots', color: LEAF },
  'town:bloom': { sprite: 'bloom', kind: 'sparkle', color: 0xf2a6d8, also: 'sparkle', alt: LEAF },
  'town:mesmerize': { sprite: 'blood_bubble', kind: 'vortex', color: VIOLET },
  'town:blood_feast': { sprite: 'blood_storm', onCaster: true, kind: 'stream', color: BLOOD },
  'town:night_terror': { sprite: 'moths', onCaster: true, kind: 'bats', color: 0x2a1a30, also: 'fog', alt: 0x302040 },
  'town:howl': { sprite: 'werewolf', onCaster: true, kind: 'ring', color: SILVER },
  'town:pack_hunt': { kind: 'ring', color: EMBER },
  'town:moon_frenzy': { sprite: 'dark_flames', kind: 'aura', color: 0xff5040 },
  'town:assemble': { sprite: 'mercury', kind: 'rise', color: CYAN, also: 'sparkle', alt: EMBER },
  'town:overclock': { sprite: 'charge', kind: 'aura', color: CYAN },
  'town:repair_swarm': { sprite: 'counterfall', kind: 'sparkle', color: CYAN },
  'town:deep_delve': { kind: 'coins', color: STONE },
  'town:forge_blessing': { sprite: 'orchid', onCaster: true, kind: 'coins', color: EMBER },
  'town:stone_skin': { sprite: 'spines', kind: 'dome', color: STONE },
  'town:tide_call': { sprite: 'foam', onCaster: true, kind: 'wave', color: SEA },
  'town:whirlpool': { sprite: 'splash', kind: 'vortex', color: SEA },
  'town:sea_fog': { sprite: 'frost', onCaster: true, kind: 'fog', color: 0xc8d4dc },
  'town:trade_road': { kind: 'coins', color: GOLD },
  'town:swift_riders': { sprite: 'leaves', onCaster: true, kind: 'ring', color: SAND },
  'town:scouting': { sprite: 'leaves', onCaster: true, kind: 'ring', color: GOLD },
  'town:glamour': { sprite: 'gold_vortex', kind: 'sparkle', color: PINK },
  'town:changeling': { sprite: 'portal', kind: 'vortex', color: PINK },
  'town:faerie_ring': { sprite: 'prism', onCaster: true, kind: 'sparkle', color: PINK, also: 'ring', alt: 0xf8f0a0 },
  'town:transmute': { sprite: 'hourglass', onCaster: true, kind: 'coins', color: GOLD },
  'town:elixir': { sprite: 'life_fountain', kind: 'sparkle', color: ACID },
  'town:volatile_flask': { sprite: 'acid', kind: 'lob', color: ACID },
  'town:rally': { sprite: 'holy', kind: 'ring', color: GOLD, also: 'aura', alt: GOLD },
  'town:shield_wall': { sprite: 'parry', kind: 'dome', color: GOLD },
  'town:oath': { sprite: 'suture', kind: 'rise', color: GOLD },
  'town:war_cry': { sprite: 'blood_storm', onCaster: true, kind: 'ring', color: BLOOD, also: 'aura', alt: EMBER },
  'town:berserk': { sprite: 'slash_fire', kind: 'bolt', color: BLOOD },
  'town:grog_feast': { sprite: 'life_fountain', kind: 'sparkle', color: ACID },
  // rival lords' spells
  'rival:drain_life': { sprite: 'void', kind: 'stream', color: GREEN_DEAD },
  'rival:raise_fallen': { sprite: 'conjure', kind: 'rise', color: GREEN_DEAD },
  'rival:bone_ward': { sprite: 'parry', kind: 'dome', color: BONE },
  'rival:entangle': { sprite: 'roots', kind: 'roots', color: LEAF },
  'rival:storm': { sprite: 'chaos_storm', onCaster: true, kind: 'bolt', color: 0xf8f0a0, also: 'rain', alt: RAIN },
  'rival:regrowth': { sprite: 'bloom', kind: 'sparkle', color: LEAF },
  'rival:mesmerise': { sprite: 'blood_bubble', kind: 'vortex', color: VIOLET },
  'rival:blood_drain': { sprite: 'blood', kind: 'stream', color: BLOOD },
  'rival:night_terror': { sprite: 'moths', onCaster: true, kind: 'bats', color: 0x2a1a30, also: 'fog', alt: 0x302040 },
  'rival:howl': { sprite: 'werewolf', onCaster: true, kind: 'ring', color: SILVER },
  'rival:frenzy': { sprite: 'dark_flames', kind: 'aura', color: 0xff5040 },
  'rival:overclock': { sprite: 'charge', kind: 'aura', color: CYAN },
  'rival:repair': { sprite: 'counterfall', kind: 'sparkle', color: CYAN },
  'rival:emp': { sprite: 'shock', kind: 'ring', color: CYAN, also: 'bolt', alt: CYAN },
  'rival:stone_skin': { sprite: 'spines', kind: 'dome', color: STONE },
  'rival:rockfall': { kind: 'rocks', color: STONE },
  'rival:whirlpool': { sprite: 'splash', kind: 'vortex', color: SEA },
  'rival:sea_fog': { sprite: 'frost', onCaster: true, kind: 'fog', color: 0xc8d4dc },
  'rival:tide': { sprite: 'splash', kind: 'wave', color: SEA },
  'rival:volley': { sprite: 'missile', kind: 'arrows', color: 0xe8dcc0 },
  'rival:plunder': { kind: 'coins', color: GOLD },
  'rival:glamour': { sprite: 'gold_vortex', kind: 'vortex', color: PINK },
  'rival:faerie_fire': { sprite: 'prism', kind: 'bolt', color: PINK },
  'rival:volatile_flask': { sprite: 'acid', kind: 'lob', color: ACID },
  'rival:elixir': { sprite: 'life_fountain', kind: 'sparkle', color: ACID },
  'rival:transmute': { sprite: 'hourglass', kind: 'rocks', color: SAND },
  'rival:rally': { sprite: 'holy', kind: 'ring', color: GOLD, also: 'aura', alt: GOLD },
  'rival:shield_wall': { sprite: 'parry', kind: 'dome', color: GOLD },
  'rival:war_cry': { sprite: 'blood_storm', onCaster: true, kind: 'ring', color: BLOOD, also: 'aura', alt: EMBER },
  'rival:war_drums': { sprite: 'void', kind: 'stream', color: BLOOD },
  'rival:more_orcs': { sprite: 'portal', kind: 'vortex', color: ACID },
  'rival:oath': { sprite: 'suture', kind: 'rise', color: GOLD },
};

