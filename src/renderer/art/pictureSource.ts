// Where a building's picture comes from away from the map (art/buildingPicture.ts draws it): a pure lookup, so the tests
// can check every building in every look without a canvas.

import { CROPS } from '../../shared/data/crops';
import { HERDS } from '../../shared/data/livestock';
import { SEAT_STAGE } from '../../shared/data/seats';
import { pickCovered } from '../map/packBuildings';

export type PictureSource = 'seat' | 'plot' | 'campfire' | 'pack' | 'painted';

/** Where a building's picture comes from in a look. `painted` is the fallback only: what no pack has in that look (a
 *  pack pass can follow for these). */
export function pictureSource(defId: string, style: string): PictureSource {
  if (SEAT_STAGE[defId]) return 'seat';
  if (CROPS[defId] || HERDS[defId]) return 'plot';
  if (defId === 'campfire') return 'campfire';
  return pickCovered(defId, style) ? 'pack' : 'painted';
}
