// Every origin's seat: the one building at the heart of its town, standing from the founding and rebuilt grander as
// each era comes (five stages, one an era), themed to the people who hold it: the settlers' moot hall, the liches' bone
// altar, the druids' great oak, the vampires' blood throne in the castle's hall, the dwarves' throne under the mountain,
// the knights' keep... The stages are building defs (`SEAT_DEFS`, merged into BUILDINGS) chained by `SEAT_UPGRADES`;
// a town has one, of its own origin only, never built new (`never`): sim/state.ts founds it and the planner rebuilds
// it (sim/planner.ts planSeat). Its picture is renderer/art/seatArt.ts.
import type { Era } from './eras';
import type { Material } from './materials';
import type { OriginId } from './origins';
import type { BuildingDef } from './buildings';

export type Stock = Partial<Record<Material, number>>;

/** What a seat does for its people beside morale, growing with each stage. */
export type SeatBoon = 'arrivals' | 'healing' | 'warning' | 'storage' | 'none';

export interface SeatDef {
  origin: OriginId;
  /** The five stages' names, Stone Age to Space. */
  names: [string, string, string, string, string];
  /** One line on each stage. */
  texts: [string, string, string, string, string];
  /** The morale reason while it stands. */
  reason: string;
  boon: SeatBoon;
  /** A material the seat's people build with, in place of hide (bone for the dead, pearls... kept to what exists). */
  flavour?: Material;
}

export const SEATS: Record<OriginId, SeatDef> = {
  settlers: {
    origin: 'settlers',
    names: ['Meeting Stone', 'Moot Hall', 'Guildhall', 'Civic Hall', 'Council Spire'],
    texts: [
      'A standing stone where the settlers gather to talk things over.',
      'A timber hall where the moot sits: the heart of the village.',
      'A stone hall of the trades, with a clock in its gable.',
      'The town\'s seat of brick and glass, flags over the door.',
      'A spire of glass and steel where the council looks out over the city.',
    ],
    reason: 'A place of our own',
    boon: 'arrivals',
  },
  lich: {
    origin: 'lich',
    names: ['Bone Altar', 'Ossuary', 'Black Ziggurat', 'Necropolis Spire', 'Throne of Unlife'],
    texts: [
      'An altar of stacked bone where the dead are called up.',
      'A vault of skulls lit green from within.',
      'A stepped tomb of black stone, the phylactery\'s light at its crown.',
      'A spire of bone and iron over the city of the dead.',
      'The lich\'s throne, a pillar of green fire at its back: death itself holds court.',
    ],
    reason: 'The master\'s will binds us',
    boon: 'none',
    flavour: 'bone',
  },
  druid: {
    origin: 'druid',
    names: ['Standing Stones', 'Sacred Grove', 'Great Oak', 'Heart Tree', 'World Tree'],
    texts: [
      'A ring of standing stones about a sapling.',
      'A grove of young trees round the stones, hung with charms.',
      'An oak grown vast and hollow: the circle meets inside it.',
      'A tree whose roots hold the town together, lit by fireflies.',
      'A tree reaching into the clouds, a living tower with the town in its shade.',
    ],
    reason: 'The grove keeps us',
    boon: 'healing',
  },
  vampire: {
    origin: 'vampire',
    names: ['Blood Throne', 'Court of Night', 'Crimson Court', 'Sanguine Palace', 'Eternal Throne'],
    texts: [
      'A throne of black wood in the castle\'s hall.',
      'The hall hung with crimson and lit by candelabra.',
      'A dais of red marble, the court about it.',
      'Gilded columns and a throne of bone and velvet.',
      'The throne of a deathless house, the hall red as blood.',
    ],
    reason: 'The court is held',
    boon: 'none',
  },
  werewolf: {
    origin: 'werewolf',
    names: ['Den Mound', 'Pack Lodge', 'Howling Hall', 'Moon Totem', 'Wolf Throne'],
    texts: [
      'A mound of earth and hides over the pack\'s den.',
      'A lodge of logs and antlers where the pack sleeps in a heap.',
      'A long hall with a wolf skull over the door; they howl from its roof.',
      'A totem to the moon before the hall, hung with trophies.',
      'The alpha\'s throne of bone under a silver moon-disc.',
    ],
    reason: 'The pack is whole',
    boon: 'none',
  },
  robot: {
    origin: 'robot',
    names: ['Core Pad', 'Control Node', 'Logic Tower', 'Central Processor', 'Overmind'],
    texts: [
      'A pad of plates with the first core humming on it.',
      'A node of consoles and cables about the core.',
      'A tower of racks and blinking lights.',
      'A processor the size of a hall, cooled by fans you can hear across town.',
      'The overmind: a dome of light, every machine its limb.',
    ],
    reason: 'The core directs us',
    boon: 'storage',
  },
  dwarves: {
    origin: 'dwarves',
    names: ['Hearth Hall', 'Throne of Stone', 'Deep Throne', 'Gilded Throne', 'Throne of the Mountain King'],
    texts: [
      'The hall under the mountain, a great hearth at its heart.',
      'A throne cut from the living rock, an anvil before it.',
      'The throne deep in the mountain, gold heaped about it.',
      'A throne of gold on a dais of gems.',
      'The mountain king\'s throne, the hold\'s whole hoard about it.',
    ],
    reason: 'The hold stands',
    boon: 'storage',
  },
  merfolk: {
    origin: 'merfolk',
    names: ['Tide Pool Shrine', 'Shell Hall', 'Coral Court', 'Pearl Palace', 'Abyssal Throne'],
    texts: [
      'A pool among the rocks where the tide brings omens.',
      'A hall roofed with one great shell.',
      'A court of living coral, red and gold.',
      'A palace under a dome of pearl.',
      'A throne from the deep, lit by things that glow.',
    ],
    reason: 'The tide is with us',
    boon: 'arrivals',
  },
  nomads: {
    origin: 'nomads',
    names: ['Chieftain\'s Tent', 'Great Yurt', 'Khan\'s Pavilion', 'Caravan Palace', 'Palace of the Horde'],
    texts: [
      'The chieftain\'s tent, its banner on a pole.',
      'A great yurt of felt and painted poles.',
      'A pavilion of silk with banners at every corner.',
      'A palace of adobe and tile where the caravans end.',
      'The horde\'s palace, its domes blue and gold.',
    ],
    reason: 'The chieftain leads',
    boon: 'arrivals',
  },
  fae: {
    origin: 'fae',
    names: ['Faerie Ring', 'Toadstool Court', 'Glamour Pavilion', 'Crystal Bower', 'Court of Seasons'],
    texts: [
      'A ring of toadstools on a mound that glows at night.',
      'A court of toadstools grown tall, a hall beneath the biggest.',
      'A pavilion that is half there, lit by will-o\'-wisps.',
      'A bower of crystal and living vines.',
      'The court of the seasons: a palace that changes with the year.',
    ],
    reason: 'The court is merry',
    boon: 'arrivals',
  },
  alchemists: {
    origin: 'alchemists',
    names: ['Still House', 'Alembic Tower', 'Athanor Hall', 'Great Laboratory', 'Philosopher\'s Tower'],
    texts: [
      'A hut of stills and a copper pot.',
      'A tower of glass globes and copper pipes.',
      'A hall built round an athanor furnace that never goes out.',
      'A laboratory of brass and glass, lightning in its jars.',
      'A tower topped with the philosopher\'s stone, glowing gold.',
    ],
    reason: 'The great work goes on',
    boon: 'healing',
  },
  knights: {
    origin: 'knights',
    names: ['Motte', 'Keep', 'Great Keep', 'Castle Donjon', 'Royal Citadel'],
    texts: [
      'A timber tower on a mound of earth.',
      'A square stone keep with the banner over it.',
      'A keep of three storeys with corner turrets.',
      'A donjon of dressed stone, its walls hung with shields.',
      'The royal citadel, towers at its corners and banners on every one.',
    ],
    reason: 'The banner flies',
    boon: 'warning',
  },
  orcs: {
    origin: 'orcs',
    names: ['Skull Pole', 'War Hut', 'Great Longhut', 'Iron Hall', 'Throne of Skulls'],
    texts: [
      'A pole hung with skulls and a fire before it, where the warband gathers.',
      'A hut of hide and tusk where the warchief holds court with a bone in his fist.',
      'A long hall of logs with trophies on every beam and a pit for settling quarrels.',
      'A hall of riveted iron plates, its doors dragged off a sacked fort.',
      'A throne of skulls on a hill of iron and bone; the whole horde can see it.',
    ],
    reason: 'The skulls on the pole',
    boon: 'warning',
  },
};

/** The era each stage belongs to (stage 1 the founding). */
export const SEAT_ERAS: readonly Era[] = ['neolithic', 'medieval', 'industrial', 'modern', 'space'];

/** Each stage's cost (the first stands from the founding, free). */
const COSTS: readonly Stock[] = [
  {},
  { wood: 30, stone: 24, hide: 6 },
  { bricks: 30, lumber: 24, iron: 8, cloth: 8 },
  { bricks: 50, steel: 24, glass: 12, coal: 20 },
  { concrete: 50, electronics: 16, glass: 20, steel: 20 },
];
/** Morale while the seat stands, by stage. */
export const SEAT_MORALE = [3, 5, 7, 9, 12] as const;
/** The cache it holds, by stage. */
const STORAGE = [0, 40, 60, 80, 100] as const;
const BOON_ARRIVALS = [0, 0.01, 0.02, 0.03, 0.04] as const;
const BOON_HEALING = [1, 1.2, 1.4, 1.6, 1.8] as const;
const BOON_WARNING = [0, 20, 30, 40, 50] as const;

/** The footprint of a seat on the land (a hold's is its hall: sim/castle.ts CORE_W by CORE_H). */
export const SEAT_W = 5;
export const SEAT_D = 3;
export const HOLD_SEAT_W = 6;
export const HOLD_SEAT_D = 4;
const HOLDS: readonly OriginId[] = ['vampire', 'dwarves'];

export const seatId = (origin: OriginId, stage: number) => `seat_${origin}_${stage}`;

/** The building defs: five stages for each origin. */
export const SEAT_DEFS: BuildingDef[] = [];
/** Which seat and stage a building id is (1..5). */
export const SEAT_STAGE: Record<string, { origin: OriginId; stage: number }> = {};
export const SEAT_UPGRADES: Record<string, string> = {};
for (const def of Object.values(SEATS)) {
  const hold = HOLDS.includes(def.origin);
  for (let i = 0; i < 5; i++) {
    const id = seatId(def.origin, i + 1);
    const cost: Stock = { ...COSTS[i] };
    if (def.flavour && cost.hide) {
      cost[def.flavour] = cost.hide;
      delete cost.hide;
    }
    const d: BuildingDef = {
      id,
      name: def.names[i],
      layer: 'mid',
      width: hold ? HOLD_SEAT_W : SEAT_W,
      depth: hold ? HOLD_SEAT_D : SEAT_D,
      cost,
      buildSeconds: [60, 400, 1200, 2400, 3600][i],
      purpose: `${def.texts[i]} The seat of the town: morale ${SEAT_MORALE[i]}${boonText(def.boon, i)}.`,
      never: true,
      era: SEAT_ERAS[i],
      origin: def.origin,
      seat: i + 1,
      morale: [SEAT_MORALE[i], def.reason],
      storage: STORAGE[i] * (def.boon === 'storage' ? 2 : 1),
    };
    if (def.boon === 'arrivals' && BOON_ARRIVALS[i]) d.arrivals = BOON_ARRIVALS[i];
    if (def.boon === 'healing' && BOON_HEALING[i] > 1) d.healing = BOON_HEALING[i];
    if (def.boon === 'warning' && BOON_WARNING[i]) d.warningMinutes = BOON_WARNING[i];
    SEAT_DEFS.push(d);
    SEAT_STAGE[id] = { origin: def.origin, stage: i + 1 };
    if (i > 0) SEAT_UPGRADES[seatId(def.origin, i)] = id;
  }
}

function boonText(boon: SeatBoon, i: number): string {
  switch (boon) {
    case 'arrivals':
      return BOON_ARRIVALS[i] ? `, wanderers come more often` : '';
    case 'healing':
      return BOON_HEALING[i] > 1 ? `, the hurt heal ${Math.round((BOON_HEALING[i] - 1) * 100)}% faster` : '';
    case 'warning':
      return BOON_WARNING[i] ? `, ${BOON_WARNING[i]} minutes' warning of raids` : '';
    case 'storage':
      return ', a deep store';
    default:
      return '';
  }
}

export const isSeat = (id: string) => id in SEAT_STAGE;
/** The town's seat among its buildings. */
export const seatOf = <B extends { def: string }>(buildings: readonly B[]): B | undefined => buildings.find((b) => isSeat(b.def));
