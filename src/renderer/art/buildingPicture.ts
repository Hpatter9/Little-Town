// A building's picture away from the map (the phone's tap card, the building card, the Town tab's thumbnails, the build
// menu): the same picture the map draws for that building in that people's look. The seat is laid from the packs by its
// people and stage, a field or pen is the map's plot (art/farmland.ts on the Fields tiles, art/fieldTiles.ts), a campfire
// the pack's; everything else is its pack picture (map/packBuildings.ts, graded for the look), and only what no pack has
// is the top-down painter's (art/topDown.ts). The lookup is pure (art/pictureSource.ts); the drawing is `buildingPicture`.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { SEAT_STAGE } from '../../shared/data/seats';
import { HERDS } from '../../shared/data/livestock';
import { depthOf } from '../../shared/sim/buildings';
import { pictureSource, type PictureSource } from './pictureSource';
import { packArt } from '../map/packBuildings';
import { seatPack } from '../map/seatPacks';
import { fieldArt } from '../map/fieldArt';
import { fieldTilesReady, campfirePack } from './fieldTiles';
import { seatArt } from './seatArt';
import { topDownArt } from './topDown';
import { noTone, textureCanvas, type PixelArt } from './pixelArt';

/** A grass green under a pen (the map shows the land there; a card has none). */
const GRASS = '#5f8f45';

const cache = new Map<string, HTMLCanvasElement>();

function artOf(defId: string, style: string, source: PictureSource): PixelArt | null {
  const def = BUILDING_BY_ID[defId];
  if (source === 'seat') {
    const seat = SEAT_STAGE[defId];
    return seatPack(seat.origin, seat.stage, def.width) ?? seatArt(seat.origin, seat.stage, def.width, depthOf(def), noTone, 'card');
  }
  if (source === 'plot') return fieldArt(defId, def.width, depthOf(def), 'ripe', noTone, 'card', 1);
  if (source === 'campfire') return (campfirePack() ?? [])[0] ?? null;
  // (a single wall piece shown straight, as the map draws a lone run)
  const join = def.hp && def.width === 1 && !def.defense && defId !== 'palisade_gate' ? 'h' : undefined;
  const art = source === 'pack' ? packArt(defId, def.width, style, 0, join) : null;
  return art ?? topDownArt(defId, def.width, depthOf(def), noTone, 'card', style);
}

/** The building's picture on a canvas that fits a `boxW` by `boxH` box, whole-pixel scaled so it stays crisp. Kept per
 *  building, look and size once its pack pictures are in; until then the painted one stands and is not kept. */
export function buildingPicture(defId: string, style: string, boxW = 96, boxH = 64): HTMLCanvasElement | null {
  const def = BUILDING_BY_ID[defId];
  if (!def) return null;
  const source = pictureSource(defId, style);
  const key = `${defId}|${style}|${boxW}x${boxH}`;
  const have = cache.get(key);
  if (have) return have;
  const art = artOf(defId, style, source);
  if (!art) return null;
  let c = textureCanvas(art.texture, boxW, boxH);
  if (source === 'plot' && HERDS[defId]) c = underGrass(c);
  // (kept once the pictures it needs are in: the pack's own, the Fields tiles; else drawn again next time)
  const settled = source === 'plot' ? fieldTilesReady() : source === 'pack' ? !!packArt(defId, def.width, style, 0) : source !== 'seat' || !!seatPack(SEAT_STAGE[defId].origin, SEAT_STAGE[defId].stage, def.width);
  c.dataset.settled = settled ? '1' : '';
  if (settled) cache.set(key, c);
  return c;
}

/** A pen's picture over grass. */
function underGrass(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const g = o.getContext('2d')!;
  g.fillStyle = GRASS;
  g.fillRect(0, 0, o.width, o.height);
  g.drawImage(c, 0, 0);
  return o;
}
