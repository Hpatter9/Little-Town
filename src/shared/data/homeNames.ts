// Names for homes (the owner's ask: "Elka's Rest", "The Old Mill House", "Bramble End"). Every home is named once its
// first owner or resident is known (sim/memorials.ts `nameHomes` keeps the name on `Building.homeName`, so a house keeps
// it through upgrades and after the one it was named for is gone), the name decided here by the home's id and that
// person's name alone: pure, the same answer every time. Three ways of naming, picked by the id: after the person
// ("Elka's Rest"), a house by its look ("The Mossy House"), or a name of the land ("Bramble End"); each people its own
// words (a lich's crypt, a dwarf's delving, a nomad's tent, a merrow's shell, a machine's berth...).

import type { OriginId } from './origins';

interface Words {
  /** After the person: "<name>'s <noun>". */
  theirs: string[];
  /** By its look: "The <adjective> <noun>". */
  looks: string[];
  nouns: string[];
  /** Names of the land: first halves and second halves run together ("Bramble" + " End", "Oak" + "shade"). */
  first: string[];
  second: string[];
}

const COMMON: Words = {
  theirs: ['Rest', 'Hearth', 'Roost', 'Corner', 'End', 'Croft', 'Cot', 'Nook', 'Haven', 'Steading', 'Fold', 'Door'],
  looks: ['Old', 'Low', 'Little', 'Green', 'Crooked', 'Long', 'Mossy', 'Bright', 'Quiet', 'Leaning', 'Red', 'White', 'Thatched', 'Lantern'],
  nouns: ['House', 'Cottage', 'Lodge', 'Hall', 'Mill House', 'Croft', 'Gables', 'Roof'],
  first: ['Bramble', 'Oak', 'Willow', 'Thistle', 'Hearth', 'Fern', 'Ash', 'Hazel', 'Honey', 'Larks', 'Rook', 'Elder', 'Clover', 'Sorrel', 'Apple', 'Moss'],
  second: [' End', 'shade', ' Cross', 'down', 'stone', ' Hollow', 'field', ' Row', ' Hill', 'brook', ' Green', 'gate'],
};

const WORDS: Partial<Record<OriginId, Words>> = {
  lich: {
    theirs: ['Barrow', 'Crypt', 'Repose', 'Vault', 'Long Sleep', 'Tomb'],
    looks: ['Quiet', 'Ashen', 'Hollow', 'Grey', 'Silent', 'Cold', 'Bone', 'Pale'],
    nouns: ['Crypt', 'Vault', 'Ossuary', 'Barrow', 'Sepulchre'],
    first: ['Hollow', 'Grave', 'Bone', 'Dusk', 'Ash', 'Raven', 'Mourn', 'Wither'],
    second: ['bone', 'watch', ' Rest', 'hold', ' Deep', 'shroud'],
  },
  vampire: {
    theirs: ['Repose', 'Chambers', 'Retreat', 'Rest', 'Bower', 'Sanctum'],
    looks: ['Crimson', 'Velvet', 'Shuttered', 'Midnight', 'Gilded', 'Dim', 'Silent'],
    nouns: ['Chamber', 'Gallery', 'Parlour', 'Hall', 'Manor'],
    first: ['Night', 'Crimson', 'Raven', 'Moon', 'Shadow', 'Thorn', 'Dusk'],
    second: ['shade', 'hollow', ' Hall', 'mere', 'fall', 'gate'],
  },
  dwarves: {
    theirs: ['Delving', 'Hall', 'Hearth', 'Seat', 'Anvil', 'Deep'],
    looks: ['Iron', 'Deep', 'Granite', 'Copper', 'Old', 'Broad', 'Low'],
    nouns: ['Hall', 'Delving', 'Burrow', 'Hold', 'Forgehouse'],
    first: ['Stone', 'Iron', 'Deep', 'Copper', 'Anvil', 'Coal', 'Gold', 'Ember'],
    second: ['hearth', 'delve', 'hall', ' Holt', 'forge', 'heim'],
  },
  nomads: {
    theirs: ['Tent', 'Yurt', 'Fire', 'Rest', 'Camp', 'Hearth'],
    looks: ['Blue', 'Striped', 'Red', 'Wide', 'Felted', 'Painted', 'Windward'],
    nouns: ['Tent', 'Yurt', 'Pavilion', 'Lodge'],
    first: ['Wind', 'Sky', 'Dust', 'Horse', 'Sun', 'Star', 'Far'],
    second: ['rest', 'fire', ' Road', 'camp', 'reach', ' Ring'],
  },
  merfolk: {
    theirs: ['Shell', 'Grotto', 'Rest', 'Mooring', 'Reef', 'Tide'],
    looks: ['Coral', 'Pearl', 'Driftwood', 'Salt', 'Blue', 'Kelp'],
    nouns: ['Hut', 'Grotto', 'Shell', 'Stilt House'],
    first: ['Tide', 'Coral', 'Wave', 'Gull', 'Salt', 'Pearl', 'Kelp', 'Foam'],
    second: ['wrack', ' Rest', 'reach', 'haven', 'mere', ' Shoal'],
  },
  druid: {
    theirs: ['Bower', 'Grove', 'Glade', 'Rest', 'Hollow', 'Den'],
    looks: ['Mossy', 'Green', 'Ivied', 'Rooted', 'Leafy', 'Old'],
    nouns: ['Bower', 'Lodge', 'Hollow', 'Treehouse'],
    first: ['Moss', 'Oak', 'Fern', 'Rowan', 'Ivy', 'Hazel', 'Yew', 'Thorn'],
    second: ['bower', 'glade', ' Hollow', 'root', 'shade', ' Ring'],
  },
  werewolf: {
    theirs: ['Den', 'Lair', 'Lodge', 'Hollow', 'Rest'],
    looks: ['Grey', 'Howling', 'Old', 'Hidden', 'Dark', 'Bone'],
    nouns: ['Den', 'Lodge', 'Hollow', 'Lair'],
    first: ['Moon', 'Wolf', 'Fang', 'Silver', 'Howl', 'Pine', 'Night'],
    second: ['hollow', 'den', ' Rise', 'shade', 'run', ' Lair'],
  },
  robot: {
    theirs: ['Berth', 'Bay', 'Cradle', 'Dock', 'Station'],
    looks: ['North', 'East', 'Upper', 'Lower', 'Quiet', 'Humming', 'Bright'],
    nouns: ['Berth', 'Charging Bay', 'Dormitory', 'Housing Block', 'Recharge Hall'],
    first: ['Unit', 'Node', 'Cell', 'Core', 'Grid', 'Relay', 'Circuit', 'Array'],
    second: [' 7', ' 12', ' 3', ' 21', ' 9', ' 4'],
  },
  fae: {
    theirs: ['Bower', 'Dell', 'Ring', 'Hollow', 'Bloom'],
    looks: ['Dewy', 'Moonlit', 'Silver', 'Glimmering', 'Hidden', 'Rose'],
    nouns: ['Bower', 'Toadstool', 'Hollow', 'Dell'],
    first: ['Dew', 'Moon', 'Thistle', 'Glimmer', 'Bluebell', 'Briar', 'Star', 'Willow'],
    second: ['drop Hollow', 'dell', 'down', ' Ring', 'bloom', 'glen'],
  },
  alchemists: {
    theirs: ['Retort', 'Workroom', 'Rest', 'Study', 'Still'],
    looks: ['Copper', 'Smoking', 'Green', 'Gilded', 'Bubbling', 'Brass'],
    nouns: ['Still', 'House', 'Crucible', 'Alembic'],
    first: ['Mercury', 'Sulphur', 'Salt', 'Copper', 'Ember', 'Vitriol', 'Quill', 'Brass'],
    second: [' House', 'stone', 'well', 'gate', ' Row', 'vale'],
  },
  knights: {
    theirs: ['Keep', 'Hall', 'Rest', 'Lodge', 'Manor', 'Tower'],
    looks: ['Old', 'Banner', 'Iron', 'White', 'Shield', 'Lance'],
    nouns: ['Hall', 'Manor', 'Lodge', 'Keep', 'House'],
    first: ['Lance', 'Shield', 'Lion', 'Oath', 'Banner', 'Hart', 'Rose', 'Sword'],
    second: ['gate', ' Hall', 'ford', 'mont', ' Keep', 'wick'],
  },
  orcs: {
    theirs: ['Hut', 'Hole', 'Lair', 'Pit', 'Den'],
    looks: ['Smoky', 'Big', 'Skull', 'Bone', 'Muddy', 'Loud', 'Spiky'],
    nouns: ['Hut', 'Hovel', 'Hole', 'Lodge'],
    first: ['Skull', 'Gut', 'Mud', 'Tusk', 'Grog', 'Bone', 'Spike', 'Smash'],
    second: ['hut', 'pit', ' Hole', 'heap', 'den', 'mound'],
  },
};

/** A small, steady hash of a home's id and a name (the same answer every time, on every device). */
function mix(id: number, name: string, salt: number): number {
  let h = (2166136261 ^ (id * 2654435761) ^ (salt * 40503)) >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
const pick = <T>(xs: readonly T[], h: number): T => xs[h % xs.length];

/** The first name of someone: who a home is named for ("Elka" of "Elka Thorn"). */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** A home's name, by its id, the person it's named for (its owner, else its eldest resident; null with nobody yet) and
 *  the town's people. */
export function homeName(id: number, who: string | null, origin: OriginId | null | undefined): string {
  const w = (origin && WORDS[origin]) || COMMON;
  const name = who ? firstName(who) : '';
  const h = mix(id, name, 1);
  // (with nobody to name it for, by its look or the land; else a third of each)
  const way = name ? h % 3 : 1 + (h % 2);
  if (way === 0) return `${name}'${name.endsWith('s') ? '' : 's'} ${pick(w.theirs, mix(id, name, 2))}`;
  if (way === 1) return `The ${pick(w.looks, mix(id, name, 3))} ${pick(w.nouns, mix(id, name, 4))}`;
  return `${pick(w.first, mix(id, name, 5))}${pick(w.second, mix(id, name, 6))}`;
}
