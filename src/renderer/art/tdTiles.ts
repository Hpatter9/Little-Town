// The raid map's ground from Craftpix's tower-defence tilesets: the Fields tileset's cobbled path (32px tiles, laid one
// to a 16px cell on the fine grid) for the trail, and the Village tileset's places for a tower under the shooters' spots.
// Loaded once; until then the map paints its own.

import { loadImage } from './loadImage';
import cobble0 from './td/cobble_0.png';
import cobble1 from './td/cobble_1.png';
import cobble2 from './td/cobble_2.png';
import cobble3 from './td/cobble_3.png';
import cobble4 from './td/cobble_4.png';
import cobble5 from './td/cobble_5.png';
import cobble6 from './td/cobble_6.png';
import cobble7 from './td/cobble_7.png';
import cobble8 from './td/cobble_8.png';
import cobble9 from './td/cobble_9.png';
import cobble10 from './td/cobble_10.png';
import cobble11 from './td/cobble_11.png';
import pad1 from './td/pad_1.png';
import pad2 from './td/pad_2.png';

export interface TdTiles {
  cobbles: HTMLImageElement[];
  pads: HTMLImageElement[];
}
const COBBLES = [cobble0, cobble1, cobble2, cobble3, cobble4, cobble5, cobble6, cobble7, cobble8, cobble9, cobble10, cobble11];
let tiles: TdTiles | null = null;
let asked: Promise<TdTiles> | null = null;

/** The tiles, once loaded (null before). */
export const tdTiles = (): TdTiles | null => tiles;
/** Load them (once). */
export function loadTdTiles(): Promise<TdTiles> {
  asked ??= Promise.all([Promise.all(COBBLES.map(loadImage)), Promise.all([pad1, pad2].map(loadImage))]).then(([cobbles, pads]) => (tiles = { cobbles, pads }));
  return asked;
}
