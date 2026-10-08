// Portals to other worlds (the owner's pick of the content updates, the sixth). Study (Planar Lore) lets the town
// raise a Portal Arch attuned to another world; now and then a rift tears open on its own. Beyond each lies a realm:
// a small map of sites to explore (sim/portals.ts), one a trip, down to its heart. Each realm has its own rules: in the
// Feywild time runs strangely (a party comes back older, or younger, or not at all, and sometimes blessed); the
// Underworld drains the living (they come back hurt, and some not at all, but its riches are doubled); the Elemental
// Planes burn, freeze or batter whoever walks them. Every trip stirs the other side, and in time things come back
// out through the portal into the town. Breaking the realm's heart calms it for good.

import type { BuildingDef } from './buildings';
import type { Material } from './materials';
import { habitatRaid, type Habitat } from './menagerie';
import type { RaidKind } from './raids';
import type { Topic } from './research';

export type RealmId = 'fae' | 'underworld' | 'elemental';
export const REALMS: readonly RealmId[] = ['fae', 'underworld', 'elemental'];

export interface RealmDef {
  id: RealmId;
  name: string;
  /** Its rule, in a line, for the menus. */
  rule: string;
  /** What's said when it opens. */
  opens: string;
  /** Its picture (a painted backdrop: art/backdrops). */
  backdrop: string;
  /** The creatures of its sites and of what comes out (the menagerie's habitats), and the boss at its heart. */
  habitats: Habitat[];
  boss: string;
  /** The sites' names. */
  sites: string[];
  /** What a site gives (each a range), and its heart over and above. */
  loot: Partial<Record<Material, [number, number]>>;
  heart: Partial<Record<Material, number>>;
  coins: [number, number];
  /** Its colour (the glow on the map, the sites' light). */
  glow: number;
  /** The raid of what comes out. */
  raid: string;
}

export const REALM_DEFS: Readonly<Record<RealmId, RealmDef>> = {
  fae: {
    id: 'fae',
    name: 'The Feywild',
    rule: 'Time runs strangely here: a party may come home years older, or younger, or blessed, or not at all.',
    opens: 'The air in the arch shivers and smells of rain and honey, and through it lies a wood where the leaves are silver and the light comes from no sun.',
    backdrop: 'crystal_1',
    habitats: ['fae', 'forest'],
    boss: 'frost_archmage',
    sites: ['the Moonlit Glade', 'the Thorn Court', 'the Laughing Pool', 'the Hollow Hill', 'the Silver Orchard', 'the Ring of Toadstools', 'the Briar Maze', 'the Weeping Willow', 'the Court of Dusk'],
    loot: { herbs: [3, 7], pearls: [1, 2], gems: [0, 1], fruit: [2, 5] },
    heart: { gems: 4, pearls: 4, herbs: 10 },
    coins: [10, 30],
    glow: 0x9ae8b0,
    raid: 'portal_fae',
  },
  underworld: {
    id: 'underworld',
    name: 'The Underworld',
    rule: 'It drains the living: a party comes home hurt, and some not at all. But its riches come double.',
    opens: 'The arch goes dark, and cold, and through it a grey road runs down between rivers that make no sound, toward a light that is not warm.',
    backdrop: 'temple_3',
    habitats: ['crypt'],
    boss: 'lich_lord',
    sites: ['the Ferryman\'s Landing', 'the Fields of Ash', 'the Bone Orchard', 'the River of Sighs', 'the Hall of Echoes', 'the Black Gate', 'the Garden of Shades', 'the Pit of Names', 'the Throne Below'],
    loot: { ghost_essence: [1, 2], bone: [3, 6], gold: [1, 3] },
    heart: { ghost_essence: 4, gold: 6, gems: 2 },
    coins: [15, 40],
    glow: 0xd06aff,
    raid: 'portal_underworld',
  },
  elemental: {
    id: 'elemental',
    name: 'The Elemental Planes',
    rule: 'The elements rage: whoever walks there comes home burned, frostbitten or battered. Its cores are worth a fortune.',
    opens: 'The arch fills with fire, then ice, then lightning, and settles on a world of all three: burning plains under a frozen sky, split by storms.',
    backdrop: 'wasteland_2',
    habitats: ['fire', 'sky', 'snow'],
    boss: 'iron_colossus',
    sites: ['the Ember Steps', 'the Frozen Spire', 'the Storm Anvil', 'the Glass Desert', 'the Cinder Falls', 'the Thunder Mesa', 'the Rime Lake', 'the Molten Gate', 'the Heart of the Elements'],
    loot: { rare_minerals: [1, 3], gems: [1, 2], sulphur: [1, 3] },
    heart: { rare_minerals: 6, gems: 4, gold: 4 },
    coins: [10, 35],
    glow: 0xff8a3a,
    raid: 'portal_elemental',
  },
};

/** Sites a realm has (the last is its heart). */
export const SITES = 7;
/** A trip's stir on the realm, and what it settles each day; past RISE_AT (never within RISE_GAP_DAYS) something comes
 *  out of the portal; a rift stirs RIFT_STIR as much. A realm whose heart is broken stirs no more. */
export const STIR_PER_TRIP = 22;
export const STIR_SETTLES = 6;
export const RISE_AT = 50;
export const RISE_GAP_DAYS = 3;
export const RIFT_STIR = 1.5;
/** A rising's raid budget against a raid's. */
export const RISE_SHARE = 0.55;
/** The creatures' tiers by the site (the deeper, the harder). */
export const SITE_TIERS: readonly [number, number][] = [[2, 3], [2, 4], [3, 5], [3, 6], [4, 7], [5, 8], [6, 9]];
/** The Feywild: years gone or given back (days of a grown-up's life), the chance one stays, and of a blessing. */
export const FAE_AGE: [number, number] = [-6, 14];
export const FAE_STAYS = 0.1;
export const FAE_BLESS = 0.35;
/** The Underworld: the health a living member loses, the chance it keeps one, and its loot doubled. */
export const UNDER_DRAIN = 0.35;
export const UNDER_KEEPS = 0.06;
/** The Elemental Planes: the chance of a burn or a frostbite a member. */
export const ELEM_HURT = 0.45;
/** A rift opens from this day, on this chance a morning, while no rift stands. */
export const RIFT_FROM_DAY = 12;
export const RIFT_DAILY = 1 / 30;
export const RIFT_HOUR = 8;

export const PLANAR_LORE: Topic = {
  id: 'planar_lore',
  name: 'Planar Lore',
  branch: 'military',
  era: 'medieval',
  seconds: 480,
  prereqs: ['arcane_arts'],
  unlocks: 'The Portal Arch: a gate to another world (the Feywild, the Underworld, the Elemental Planes), its riches and its dangers',
  effects: [],
};

export const PORTAL_ARCH = 'portal_arch';
export const PORTAL_RIFT = 'portal_rift';
export const PORTAL_BUILDINGS: BuildingDef[] = [
  { id: PORTAL_ARCH, name: 'Portal Arch', layer: 'mid', width: 3, cost: { stone: 30, gems: 2, wood: 10 }, buildSeconds: 220, purpose: 'A standing arch attuned to another world: parties go through to explore it, and things come back out.', research: 'planar_lore' },
  { id: PORTAL_RIFT, name: 'Planar Rift', layer: 'mid', width: 2, cost: {}, buildSeconds: 1, purpose: 'A tear in the world that opened by itself: another realm lies through it, and it will not close.', never: true },
];

/** What comes out of each realm. */
export const PORTAL_RAIDS: readonly RaidKind[] = REALMS.map((r) => habitatRaid(REALM_DEFS[r].raid, `Things out of ${REALM_DEFS[r].name}`, REALM_DEFS[r].habitats, [3, 7], { weight: 0, fromDay: 0 }));
