// Origins: who founds the town. Chosen on the New town screen, an origin changes how the whole game plays: who the
// townsfolk are (the living, the raised dead, machines), what they need, what they're good and bad at, the powers
// the town calls on by itself (spells and rituals: see sim/powers.ts), and how everything looks (see
// renderer/theme.ts). Settlers are the classic game. Numbers are starting points for tuning.

import type { Material } from './materials';
import type { MonsterKind } from './monsters';
import type { Era } from './eras';

export const ORIGINS = ['settlers', 'lich', 'druid', 'vampire', 'werewolf', 'robot', 'dwarves', 'merfolk', 'nomads', 'fae', 'alchemists', 'knights'] as const;
export type OriginId = (typeof ORIGINS)[number];

/** How an origin bends the rules (anything left out is as usual). */
export interface OriginRules {
  /** Who joins the town: the raised dead (they never eat, sleep or sicken, heal slowly, never marry), machines (the
   *  same, and their spirits never waver), or the living. */
  kin?: 'undead' | 'machine' | 'werewolf';
  /** Nobody wanders in: the town makes its own people (a power does). */
  noWanderers?: boolean;
  /** Newcomers at the gate are let in by the town itself (the horde gathers whoever comes); everyone else's
   *  wanderers are a question to the player (people join only by their leave, a prisoner won over, or birth). */
  freeJoin?: boolean;
  /** The founder is one of these from the start. */
  founder?: MonsterKind | 'lich' | 'machine';
  /** Everyone works this much faster (or slower) by day and by night. */
  day?: number;
  night?: number;
  /** Construction, field growth, foraging, research and crafting speed. */
  build?: number;
  crops?: number;
  forage?: number;
  research?: number;
  craft?: number;
  /** Crafted things come out this many grades finer (or coarser) than usual. */
  quality?: number;
  /** Strangers come this much more often, and pay this much more. */
  travellers?: number;
  prices?: number;
  /** Raid kinds made more or less likely (0: never). */
  raids?: Partial<Record<string, number>>;
  /** Cleared forest grows back (a tile at a time). */
  regrow?: boolean;
  /** Spirits never sink below this. */
  moraleFloor?: number;
  /** The fallen are taken alive this many times as often (sim/prisoners.ts: the Blood Court keeps prisoners for blood). */
  captives?: number;
  /** On a full moon everyone works and fights harder. */
  moonFury?: boolean;
  /** Townsfolk fight this much harder, and take this much less in a raid. */
  fight?: number;
  guard?: number;
  /** Newcomers come with a strange gift: a random extra trait. */
  mutate?: boolean;
  /** The town is a castle: its halls, workshops and bedchambers are rooms stacked up a keep that grows upward
   *  (sim/castle.ts); only yards, fields, mines and walls stay outside. */
  castle?: boolean;
  /** The town is a hold carved into a mountain (sim/castle.ts with `hold: 'mountain'`): the land is half mountain,
   *  the halls are rooms cut into the rock behind one gate, and the yards and fields lie outside on the terrain. */
  hold?: 'mountain';
  /** The land's shape besides (sim/land.ts `LandShape`): `sea`, half the land sea south of the camp, the town always on
   *  the coast, its people swimming and building in the water (sim/sea.ts; the merfolk). */
  shape?: 'sea';
  /** Keeps to its own: strangers of other peoples are turned from the gate (sim/strangers.ts). */
  xenophobic?: true;
  /** The town moves with the seasons (sim/nomads.ts): its tents and wagons between a winter ground and a summer
   *  pasture, until it reaches this era and settles for good. */
  nomadic?: { until: Era };
}

export interface OriginDef {
  id: OriginId;
  name: string;
  /** What the town is called ("Chronos Necropolis"). */
  town: string;
  description: string;
  /** Its strengths and weaknesses, for the New town screen. */
  features: string[];
  start: {
    /** Recruit types who come with the founder (the kin rule applies to them too). */
    companions?: string[];
    stores?: Partial<Record<Material, number>>;
    research?: string[];
    items?: Record<string, number>;
    /** Buildings standing from the start, beside the camp. */
    buildings?: string[];
  };
  rules: OriginRules;
  /** The powers the town calls on (see sim/powers.ts). */
  powers: string[];
}

export const ORIGIN_DEFS: Record<OriginId, OriginDef> = {
  settlers: {
    id: 'settlers',
    name: 'Settlers',
    town: 'Chronos Settlement',
    description: 'Ordinary folk making a home. The classic game.',
    features: ['No magic of their own: they learn a trick from every people they meet, and strangers who settle teach their trades', 'The frontier: land claims staked and homesteaded at the edge of the known land (claim-jumpers come for them)'],
    start: {},
    rules: {},
    powers: [],
  },
  lich: {
    id: 'lich',
    name: 'Lich',
    town: 'Chronos Necropolis',
    description: 'A lich and the dead they raise. The dead never eat, sleep or sicken, but they heal slowly and never have children.',
    features: ['The founder is a lich from the start, bound to a phylactery', 'Every townsperson is raised dead: no food, no sleep', 'Raises new workers from bone; wanderers shun the town', 'Spells: Raise Dead, Bone Ward, Drain Life'],
    start: { companions: ['gatherer', 'gatherer'], stores: { bone: 24, berries: 6 }, buildings: ['phylactery'] },
    rules: { kin: 'undead', founder: 'lich', raids: { zombies: 0 } },
    powers: ['raise_dead', 'bone_ward', 'drain_life'],
  },
  druid: {
    id: 'druid',
    name: 'Druid Grove',
    town: 'Chronos Grove',
    description: 'A druid circle. Fields grow fast, the forest grows back, and the grove answers when called.',
    features: ['Fields grow 40% faster; foraging 30% faster', 'Cleared forest grows back', 'The grove is alive: felling angers it, regrowth and the seasons\' rites please it; pleased, it blesses the fields and sends beasts to guard the town', 'Builds slower, and works metal badly', 'Spells: Call Rain, Entangle, Bloom'],
    start: { companions: ['gatherer'], stores: { berries: 20, herbs: 10 }, research: ['foraging', 'herbalism'] },
    rules: { crops: 1.4, forage: 1.3, regrow: true, build: 0.85, quality: -0.5, raids: { wolves: 0.5 } },
    powers: ['call_rain', 'entangle', 'bloom'],
  },
  vampire: {
    id: 'vampire',
    name: 'Blood Court',
    town: 'Chronos Nocturne',
    description: 'A vampire lord and their thralls, in a castle that climbs higher with every room. It comes alive at night; the Hunter\'s Guild never forgets.',
    features: ['The founder is a vampire from the start', 'The town is a castle: every room is built on, floor by floor, up a growing keep', 'Everyone works hard by night, slower by day', 'Thralls: spirits never sink low', 'Blood is a resource: the thralls\' tithe each dusk, the pens, and prisoners kept and bled in the Blood Farm; the Court drinks from the store, and brews the rest into blood wine', 'The fallen are taken alive twice as often', 'Spells: Mesmerise, Blood Feast, Night Terror'],
    start: { companions: ['gatherer', 'hunter'], stores: { berries: 20 } },
    rules: { founder: 'vampire', day: 0.85, night: 1.3, moraleFloor: 35, prices: 1.1, castle: true, captives: 2 },
    powers: ['mesmerize', 'blood_feast', 'night_terror'],
  },
  werewolf: {
    id: 'werewolf',
    name: 'Moon Pack',
    town: 'Chronos Den',
    description: 'A werewolf and their pack. Wolves run with them, and the full moon makes them fierce.',
    features: ['Everyone is a werewolf: the pack hunts under every full moon', 'Three rival packs hold the hills: break them, and they are your hunting grounds', 'The strongest may challenge the Alpha; the Great Hunt wins the game', 'Spells: Howl, Pack Hunt, Moon Frenzy'],
    start: { companions: ['hunter', 'hunter'], stores: { berries: 12, meat: 12 } },
    rules: { founder: 'werewolf', kin: 'werewolf', raids: { wolves: 0 }, moonFury: true, fight: 1.15, forage: 1.15 },
    powers: ['howl', 'pack_hunt', 'moon_frenzy'],
  },
  robot: {
    id: 'robot',
    name: 'Machine Colony',
    town: 'Chronos Array',
    description: 'Machines from a fallen ship. They never eat or tire, think fast, and build more of themselves from salvage.',
    features: ['Everyone is a machine: no food, no sleep, steady spirits', 'Research 30% faster', 'Nobody wanders in: new units are assembled from salvage, on a production line', 'Runs on power (the sun, cells, coal, a power station): brown-outs and blackouts; units wear out and are mended with parts; spare circuits become modules', 'Once its seat grows into a Mind, it gives directives, and does not like being overruled', 'Powers: Assemble, Overclock, Repair Swarm'],
    start: { companions: ['crafter'], stores: { alloys: 16, circuits: 8, stone: 20 }, research: ['flint_knapping', 'stoneworking'] },
    rules: { kin: 'machine', founder: 'machine', noWanderers: true, research: 1.3, crops: 0.8 },
    powers: ['assemble', 'overclock', 'repair_swarm'],
  },
  dwarves: {
    id: 'dwarves',
    name: 'Deep Hold',
    town: 'Chronos Hold',
    description: 'Dwarves of the mountain: master builders and crafters, poor farmers, stubborn in a fight. Their halls are carved into the rock behind one gate.',
    features: ['The land is half mountain: the halls are rooms cut into the rock, behind a single gate; fields and yards lie outside', 'Build 30% faster; crafted things come out finer', 'Poor farmers: fields grow slower', 'Tough: take less harm in raids', 'Keep to their own: strangers of other peoples are turned from the gate', 'Rituals: Deep Delve, Forge Blessing, Stone Skin'],
    start: { companions: ['crafter'], stores: { stone: 30, flint: 10, berries: 16 }, research: ['flint_knapping', 'stoneworking'] },
    rules: { build: 1.3, quality: 1.5, crops: 0.7, guard: 0.85, hold: 'mountain', xenophobic: true },
    powers: ['deep_delve', 'forge_blessing', 'stone_skin'],
  },
  merfolk: {
    id: 'merfolk',
    name: 'Tide Clan',
    town: 'Chronos Harbour',
    description: 'Merfolk of the shore. Half their land is the sea: they swim it, fish it for fish, kelp and pearls, and build their homes in the shallows. Ships bring far more travellers; so do pirates.',
    features: ['Always on the coast: the south half of the land is sea, with shallows along the shore', 'Everyone swims; homes, the seat and the defences stand in the water', 'The sea gives fish, kelp and pearls, and gives again each dawn', 'Foraging 50% faster; travellers come half again as often', 'Pirates come more; fields grow slower', 'Spells: Tide Call, Whirlpool, Sea Fog'],
    start: { companions: ['gatherer'], stores: { berries: 20, meat: 6 }, research: ['foraging'] },
    rules: { forage: 1.5, crops: 0.8, travellers: 1.5, raids: { pirates: 2 }, shape: 'sea' },
    powers: ['tide_call', 'whirlpool', 'sea_fog'],
  },
  nomads: {
    id: 'nomads',
    name: 'Nomad Caravan',
    town: 'Chronos Waystation',
    description: 'A tribe that follows the seasons: summer on the pasture, winter on the home ground, until the Industrial age, when their home ground becomes a caravan city. Quick to pitch camp, great traders, restless.',
    features: ['The camp moves with the seasons: tents, workshops, shop and tavern go on the wagons; the great works stay on the home ground', 'No walls while they wander: the wagons are drawn into a circle when raiders come', 'Settle for good in the Industrial age', 'Build 40% faster; travellers come twice as often, and pay more', 'Research slower; fields left behind at each move', 'Rituals: Trade Road, Swift Riders, Scouting Party'],
    start: { companions: ['hunter', 'gatherer'], stores: { hide: 10, berries: 25 }, research: ['foraging'] },
    rules: { build: 1.4, travellers: 2, prices: 1.15, research: 0.85, nomadic: { until: 'industrial' }, freeJoin: true },
    powers: ['trade_road', 'swift_riders', 'scouting'],
  },
  fae: {
    id: 'fae',
    name: 'Fae Court',
    town: 'Chronos Glade',
    description: 'The fair folk. Their glamour charms coin from strangers, and strangers into staying.',
    features: ['Strangers pay half again as much', 'Glamoured travellers may join the town', 'The Court comes at moonrise with bargains: a boon now, a price later, and the fair folk always collect', 'Cold iron in the stores hurts them; a charmed Court holds revels under the full moon', 'Iron dulls them: crafting slower', 'Spells: Glamour, Changeling, Faerie Ring'],
    start: { companions: ['gatherer'], stores: { berries: 20, herbs: 6 } },
    rules: { prices: 1.5, travellers: 1.2, craft: 0.8, moraleFloor: 25 },
    powers: ['glamour', 'changeling', 'faerie_ring'],
  },
  alchemists: {
    id: 'alchemists',
    name: 'Crucible',
    town: 'Chronos Crucible',
    description: 'Alchemists and their experiments. Clever, and a little strange: newcomers come out changed.',
    features: ['Research 30% faster', 'Newcomers gain a strange gift (an extra trait)', 'The Great Work: daily experiments (some explode) through five stages, homunculi and elixirs, to the Philosopher\'s Stone and the game won', 'Poor builders', 'Workings: Transmute, Elixir, Volatile Flask'],
    start: { companions: ['elder'], stores: { herbs: 15, berries: 18 }, research: ['herbalism', 'fire_keeping'] },
    rules: { research: 1.3, mutate: true, build: 0.85 },
    powers: ['transmute', 'elixir', 'volatile_flask'],
  },
  knights: {
    id: 'knights',
    name: 'Exiled Order',
    town: 'Chronos Bastion',
    description: 'Knights in exile. Armed and armoured from the first day, hard to break, slow to learn a trade.',
    features: ['Start with three fighters, arms and armour, and palisades known', 'Fight harder, take less harm', 'The code: vows sworn and kept (or broken), knighthoods, weekly tournaments, the liege\'s call, and the Grail quest, which wins the game', 'Crafting slower, research slower', 'Rites: Rally, Shield Wall, Oath of Mending'],
    start: {
      companions: ['hunter', 'hunter'],
      stores: { berries: 24, wood: 20 },
      research: ['flint_knapping', 'spear_hunting', 'woodcutting', 'palisades'],
      items: { spear: 3, wicker_shield: 3 },
    },
    rules: { fight: 1.3, guard: 0.8, craft: 0.75, research: 0.85 },
    powers: ['rally', 'shield_wall', 'oath'],
  },
};

export const originOf = (s: { origin?: OriginId }): OriginDef => ORIGIN_DEFS[s.origin ?? 'settlers'] ?? ORIGIN_DEFS.settlers;
export const rulesOf = (s: { origin?: OriginId }): OriginRules => originOf(s).rules;
