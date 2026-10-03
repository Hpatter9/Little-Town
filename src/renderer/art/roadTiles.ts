// The town's roads from Craftpix's Path and Road top-down tileset: 16px tiles, a road two tiles wide, so each 32px
// road cell is four quarter-tiles picked by which neighbours are road (`roads/roadTiles.json`, worked out from the
// sheets: for each quarter, whether the road goes on past its two outer sides and across its outer corner). One
// style per era (slabs, then cobbles, bricks, paving), with grass tufts at the edges on green ground and bare earth
// on sand, soil and rock. Until the sheets load, the painted path stands.

import type { Era } from '../../shared/data/eras';
import { loadImage } from './loadImage';
import tables from './roads/roadTiles.json';
import road1Grass from './roads/road1_grass.png';
import road1Ground from './roads/road1_ground.png';
import road2Grass from './roads/road2_grass.png';
import road2Ground from './roads/road2_ground.png';
import road4Grass from './roads/road4_grass.png';
import road4Ground from './roads/road4_ground.png';
import road5Grass from './roads/road5_grass.png';
import road5Ground from './roads/road5_ground.png';
import groundGrass from './roads/ground_grass.png';

export type RoadStyle = 'road1' | 'road2' | 'road4' | 'road5';
/** Which road each era lays: beaten slabs, then cobbles, then bricks, then paving. */
export const ROAD_BY_ERA: Record<Era, RoadStyle> = { neolithic: 'road5', medieval: 'road1', industrial: 'road2', modern: 'road4', space: 'road4' };

const TILE = 16;
const URLS: Record<string, string> = {
  road1_grass: road1Grass,
  road1_ground: road1Ground,
  road2_grass: road2Grass,
  road2_ground: road2Ground,
  road4_grass: road4Grass,
  road4_ground: road4Ground,
  road5_grass: road5Grass,
  road5_ground: road5Ground,
  ground: groundGrass,
};
const TABLES = tables as unknown as Record<string, Record<string, [number, number]>>;

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

/** Load every road sheet (once). */
export function loadRoadTiles(): Promise<void> {
  if (!loading)
    loading = Promise.all(
      Object.entries(URLS).map((e) =>
        loadImage(e[1]).then(
          (im) => images.set(e[0], im),
          () => undefined,
        ),
      ),
    ).then(() => undefined);
  return loading;
}

export const roadTilesReady = () => images.size === Object.keys(URLS).length;

/** Draw one road cell at (px, py) on a 2D canvas: `has(dx, dy)` says whether the neighbouring cell is road too. */
export function drawRoadCell(g: CanvasRenderingContext2D, px: number, py: number, style: RoadStyle, onGrass: boolean, has: (dx: number, dy: number) => boolean): boolean {
  const name = `${style}_${onGrass ? 'grass' : 'ground'}`;
  const im = images.get(name);
  const table = TABLES[name];
  if (!im || !table) return false;
  const quarter = (quad: string, x: number, y: number, a: boolean, b: boolean, d: boolean) => {
    const t = table[`${quad}${a ? 1 : 0}${b ? 1 : 0}${a && b && d ? 1 : 0}`];
    if (t) g.drawImage(im, t[0] * TILE, t[1] * TILE, TILE, TILE, x, y, TILE, TILE);
  };
  quarter('nw', px, py, has(0, -1), has(-1, 0), has(-1, -1));
  quarter('ne', px + TILE, py, has(0, -1), has(1, 0), has(1, -1));
  quarter('sw', px, py + TILE, has(0, 1), has(-1, 0), has(-1, 1));
  quarter('se', px + TILE, py + TILE, has(0, 1), has(1, 0), has(1, 1));
  return true;
}

/** The bare-earth patch on the pack's grass sheet (a round, grass-edged blob). */
const PATCH: [number, number, number, number] = [154, 26, 29, 29];

/** A worn patch of earth centred at (cx, cy) on a 2D canvas, `size` px across, faded by `alpha`: footpaths are
 *  strings of these where people walk. False until the sheet has loaded. */
export function drawWornPatch(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number): boolean {
  const im = images.get('ground');
  if (!im) return false;
  g.globalAlpha = alpha;
  g.drawImage(im, PATCH[0], PATCH[1], PATCH[2], PATCH[3], Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
  g.globalAlpha = 1;
  return true;
}
