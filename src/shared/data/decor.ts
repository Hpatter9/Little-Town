// How a venue is dressed (the owner's ask): every shop and tavern opens with a few basic furnishings, and what the
// town spends on it after that is a **décor direction** its keeper decides from their own nature (a greedy keeper
// gilds the place, a pious one whitewashes it, a jolly one hangs bunting): five levels, each bought with coins, that
// make it feel better, grander and more attractive: painted walls, rugs and a runner, hangings at the windows, lamps,
// and at last gilded trim. The look is the panel's (renderer/panel/shopPanel.ts); the appeal is the sim's.

import type { NatureId } from './natures';

export type DecorId = 'rustic' | 'cosy' | 'stately' | 'austere' | 'opulent' | 'garden' | 'sombre' | 'festive';

export interface DecorStyle {
  id: DecorId;
  name: string;
  /** The keeper's word for it (the venue's log). */
  line: string;
  /** Paint on the walls (level 1), the rug and its border (2), the hangings (3), the lamps' light (4), the trim (5). */
  wall: string;
  wallTrim: string;
  rug: [string, string];
  hanging: string;
  lamp: string;
  trim: string;
}

export const DECOR_STYLES: Readonly<Record<DecorId, DecorStyle>> = {
  rustic: { id: 'rustic', name: 'Rustic', line: 'plain timber, hides on the floor and antlers on the wall', wall: '#8a6a44', wallTrim: '#5a3a22', rug: ['#a88258', '#7c5c3c'], hanging: '#6a4a2a', lamp: '#f0b060', trim: '#b08a3a' },
  cosy: { id: 'cosy', name: 'Cosy', line: 'warm red walls, thick rugs and a lamp in every corner', wall: '#9a4a3a', wallTrim: '#6a2a1e', rug: ['#8a2a3a', '#c8a050'], hanging: '#c04a3a', lamp: '#ffc070', trim: '#d0a040' },
  stately: { id: 'stately', name: 'Stately', line: 'deep blue walls, a long carpet and gold on the mouldings', wall: '#2c4a7a', wallTrim: '#1a2c4a', rug: ['#1e3a6a', '#d8b050'], hanging: '#3a5a9a', lamp: '#ffe0a0', trim: '#f0c848' },
  austere: { id: 'austere', name: 'Austere', line: 'whitewash, clean boards and nothing that isn\'t needed', wall: '#e8e0d0', wallTrim: '#a09888', rug: ['#c8bca8', '#a09080'], hanging: '#d8d0c0', lamp: '#fff0d0', trim: '#c0b8a8' },
  opulent: { id: 'opulent', name: 'Opulent', line: 'purple and gold, velvet at the windows and a chandelier', wall: '#5a2a6a', wallTrim: '#3a1a4a', rug: ['#6a1a7a', '#f0c848'], hanging: '#8a2a9a', lamp: '#fff0b0', trim: '#ffd860' },
  garden: { id: 'garden', name: 'Garden', line: 'green walls, flowers in pots and light cloth at the windows', wall: '#5a8a4a', wallTrim: '#3a5a2a', rug: ['#7aa060', '#e0d090'], hanging: '#a8d090', lamp: '#f0f0b0', trim: '#c8c070' },
  sombre: { id: 'sombre', name: 'Sombre', line: 'dark panelling, black drapes and candlelight', wall: '#3a3038', wallTrim: '#201820', rug: ['#2a1a2a', '#6a4a6a'], hanging: '#201020', lamp: '#f0a050', trim: '#8a7a60' },
  festive: { id: 'festive', name: 'Festive', line: 'bright paint, bunting across the room and a lantern at the door', wall: '#d8a040', wallTrim: '#a06a20', rug: ['#d04040', '#f0e060'], hanging: '#40a0d0', lamp: '#ffe080', trim: '#f08040' },
};

/** The direction a keeper of each nature takes. */
export const DECOR_OF_NATURE: Readonly<Record<NatureId, DecorId>> = {
  cheerful: 'cosy', grumpy: 'rustic', shy: 'garden', bold: 'stately', dreamy: 'garden', pious: 'austere', greedy: 'opulent',
  kind: 'cosy', proud: 'stately', curious: 'garden', gloomy: 'sombre', jolly: 'festive', stern: 'austere', restless: 'festive',
};

/** The five levels, in order, and what each does to the room. */
export const DECOR_LEVELS: readonly { name: string; text: string }[] = [
  { name: 'Painted walls', text: 'the walls painted in the style' },
  { name: 'Rugs laid', text: 'a rug by the counter and a runner from the door' },
  { name: 'Hangings', text: 'hangings at the windows and on the wall' },
  { name: 'Lamps', text: 'lamps along the walls, lit after dark' },
  { name: 'Fine trim', text: 'trim along the skirting and the counter' },
];
export const DECOR_MAX = DECOR_LEVELS.length;
/** What each level costs (times the era's PURSE_SCALE), and the appeal (or comfort) each adds. */
export const DECOR_COST = [40, 80, 140, 220, 320] as const;
export const DECOR_APPEAL = 4;

/** The basic furnishings every venue opens with (never bought: they come with the building). A bed goes in a guest
 *  room. */
export const STARTERS: Readonly<Record<string, readonly string[]>> = {
  trading_post: ['plank_shelf', 'crate_stand'],
  general_store: ['plank_shelf', 'trestle_table', 'crate_stand'],
  emporium: ['oak_shelves', 'display_table', 'plank_shelf'],
  fireside_inn: ['log_table', 'barrels', 'straw_pallet'],
  tavern: ['oak_table', 'log_table', 'stone_hearth', 'straw_pallet'],
  furniture_store: ['trestle_table', 'plank_shelf'],
  weapon_store: ['plank_shelf', 'crate_stand'],
  armour_store: ['crate_stand', 'plank_shelf'],
  apothecary_shop: ['plank_shelf', 'herb_planter'],
};
