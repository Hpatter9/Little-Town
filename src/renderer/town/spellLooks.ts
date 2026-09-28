// How each spell looks (drawn by spellsView.ts): the kind of effect, and its colours. Kept apart from the drawing so
// the tests can check every power and rival spell has one.

/** How each spell looks: the kind of effect, and its colours. */
export type Kind = 'bolt' | 'stream' | 'roots' | 'rain' | 'fog' | 'ring' | 'rise' | 'arrows' | 'lob' | 'rocks' | 'vortex' | 'dome' | 'sparkle' | 'bats' | 'coins' | 'aura' | 'wave';
export interface Look {
  kind: Kind;
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
  // the town's own powers
  'town:raise_dead': { kind: 'rise', color: GREEN_DEAD },
  'town:bone_ward': { kind: 'dome', color: BONE },
  'town:drain_life': { kind: 'stream', color: GREEN_DEAD },
  'town:call_rain': { kind: 'rain', color: RAIN },
  'town:entangle': { kind: 'roots', color: LEAF },
  'town:bloom': { kind: 'sparkle', color: 0xf2a6d8, also: 'sparkle', alt: LEAF },
  'town:mesmerize': { kind: 'vortex', color: VIOLET },
  'town:blood_feast': { kind: 'stream', color: BLOOD },
  'town:night_terror': { kind: 'bats', color: 0x2a1a30, also: 'fog', alt: 0x302040 },
  'town:howl': { kind: 'ring', color: SILVER },
  'town:pack_hunt': { kind: 'ring', color: EMBER },
  'town:moon_frenzy': { kind: 'aura', color: 0xff5040 },
  'town:assemble': { kind: 'rise', color: CYAN, also: 'sparkle', alt: EMBER },
  'town:overclock': { kind: 'aura', color: CYAN },
  'town:repair_swarm': { kind: 'sparkle', color: CYAN },
  'town:deep_delve': { kind: 'coins', color: STONE },
  'town:forge_blessing': { kind: 'coins', color: EMBER },
  'town:stone_skin': { kind: 'dome', color: STONE },
  'town:tide_call': { kind: 'wave', color: SEA },
  'town:whirlpool': { kind: 'vortex', color: SEA },
  'town:sea_fog': { kind: 'fog', color: 0xc8d4dc },
  'town:trade_road': { kind: 'coins', color: GOLD },
  'town:swift_riders': { kind: 'ring', color: SAND },
  'town:scouting': { kind: 'ring', color: GOLD },
  'town:glamour': { kind: 'sparkle', color: PINK },
  'town:changeling': { kind: 'vortex', color: PINK },
  'town:faerie_ring': { kind: 'sparkle', color: PINK, also: 'ring', alt: 0xf8f0a0 },
  'town:transmute': { kind: 'coins', color: GOLD },
  'town:elixir': { kind: 'sparkle', color: ACID },
  'town:volatile_flask': { kind: 'lob', color: ACID },
  'town:rally': { kind: 'ring', color: GOLD, also: 'aura', alt: GOLD },
  'town:shield_wall': { kind: 'dome', color: GOLD },
  'town:oath': { kind: 'rise', color: GOLD },
  // rival lords' spells
  'rival:drain_life': { kind: 'stream', color: GREEN_DEAD },
  'rival:raise_fallen': { kind: 'rise', color: GREEN_DEAD },
  'rival:bone_ward': { kind: 'dome', color: BONE },
  'rival:entangle': { kind: 'roots', color: LEAF },
  'rival:storm': { kind: 'bolt', color: 0xf8f0a0, also: 'rain', alt: RAIN },
  'rival:regrowth': { kind: 'sparkle', color: LEAF },
  'rival:mesmerise': { kind: 'vortex', color: VIOLET },
  'rival:blood_drain': { kind: 'stream', color: BLOOD },
  'rival:night_terror': { kind: 'bats', color: 0x2a1a30, also: 'fog', alt: 0x302040 },
  'rival:howl': { kind: 'ring', color: SILVER },
  'rival:frenzy': { kind: 'aura', color: 0xff5040 },
  'rival:overclock': { kind: 'aura', color: CYAN },
  'rival:repair': { kind: 'sparkle', color: CYAN },
  'rival:emp': { kind: 'ring', color: CYAN, also: 'bolt', alt: CYAN },
  'rival:stone_skin': { kind: 'dome', color: STONE },
  'rival:rockfall': { kind: 'rocks', color: STONE },
  'rival:whirlpool': { kind: 'vortex', color: SEA },
  'rival:sea_fog': { kind: 'fog', color: 0xc8d4dc },
  'rival:tide': { kind: 'wave', color: SEA },
  'rival:volley': { kind: 'arrows', color: 0xe8dcc0 },
  'rival:plunder': { kind: 'coins', color: GOLD },
  'rival:glamour': { kind: 'vortex', color: PINK },
  'rival:faerie_fire': { kind: 'bolt', color: PINK },
  'rival:volatile_flask': { kind: 'lob', color: ACID },
  'rival:elixir': { kind: 'sparkle', color: ACID },
  'rival:transmute': { kind: 'rocks', color: SAND },
  'rival:rally': { kind: 'ring', color: GOLD, also: 'aura', alt: GOLD },
  'rival:shield_wall': { kind: 'dome', color: GOLD },
  'rival:oath': { kind: 'rise', color: GOLD },
};

