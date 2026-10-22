// The raid board in the isometric look (the Settings switch, iso/isoSetting.ts): the tile tops are the town's people's
// kit ground tiles and the wall, the gate and the towers on it are the kit's pieces (iso/isoKits.ts). The kit's
// pictures are loaded by URL the first time they're wanted. With the switch off nothing here is used.

import { Texture } from 'pixi.js';
import { loadImage } from '../art/loadImage';
import { groundTile, kitNameFor, kitOf, kitUrl, pieceFor, type Kit } from '../iso/isoKits';
import type { Ground } from '../../shared/sim/land';
import type { TileLook } from '../../shared/sim/raidBoards';

/** The ground tiles the board borrows from a kit whatever the town's people: a hand-made board's looks
 *  (sim/raidBoards.ts), and water, sand and cliffs on any board (the kits' own four ground tiles differ by people, and
 *  a settler's dirt tinted blue, sand-yellow or grey read as dark ground, not a river, a dune or a rock face). [kit,
 *  tile, tint]. */
const LOOKS: Record<TileLook, [string, string, number]> = {
  dirt: ['settlers', 'dirt_tile', 0xffffff],
  field: ['settlers', 'field_tile', 0xffffff],
  flag: ['dwarves', 'flagstone_tile', 0xffffff],
  snow: ['moonpack', 'snow_tile', 0xffffff],
  ice: ['moonpack', 'snow_tile', 0x9cc8ec],
  mud: ['orcs', 'mud_tile', 0xffffff],
  plank: ['settlers', 'dirt_tile', 0xc08850],
};
const BORROWED: Partial<Record<Ground, [string, string, number]>> = {
  water: ['merfolk', 'shallow_water_tile', 0x7894cc],
  shallows: ['merfolk', 'shallow_water_tile', 0xffffff],
  sand: ['merfolk', 'sand_tile', 0xffffff],
  mountain: ['dwarves', 'rocky_tile', 0x9a968e],
};
/** The props on a hand-made board are the settlers' kit's pieces whatever the town's people (every kit has walls and
 *  gates, not every one carts and barrels). */
const PROP_KIT = 'settlers';

export class IsoBoardArt {
  kit: Kit = kitOf('settlers');
  private readonly images = new Map<string, HTMLImageElement | null>();
  private readonly texs = new Map<string, Texture>();
  private readonly sides = new Map<string, [string, string, string]>();
  /** Counts the pictures that have arrived (the board's key, so it is built again when more are in). */
  arrived = 0;

  setKit(origin: string, theme?: string): void {
    this.kit = kitOf(kitNameFor(origin, theme));
  }

  /** A kit piece's picture, null until it has loaded. */
  image(piece: string, kit = this.kit.name): HTMLImageElement | null {
    const url = kitUrl(kit, piece);
    const had = this.images.get(url);
    if (had !== undefined) return had;
    this.images.set(url, null);
    loadImage(url)
      .then((im) => {
        this.images.set(url, im);
        this.arrived++;
      })
      .catch(() => undefined);
    return null;
  }

  texture(piece: string, kit = this.kit.name): Texture | null {
    const im = this.image(piece, kit);
    if (!im) return null;
    const url = kitUrl(kit, piece);
    let t = this.texs.get(url);
    if (!t) this.texs.set(url, (t = Texture.from(im)));
    return t;
  }

  /** The piece for a building (a wall, a gate, a tower), by its def. */
  piece(def: string): string {
    return pieceFor(this.kit, def);
  }

  /** A hand-made board's prop (a cart, barrels, a fence...), null while it loads. */
  prop(piece: string): Texture | null {
    return this.texture(piece, PROP_KIT);
  }

  /** The ground tile of a board tile and its tint (null while it loads). */
  top(g: Ground, road: boolean, look?: TileLook): { im: HTMLImageElement; tint: number; piece: string } | null {
    const lent = look ? LOOKS[look] : road ? undefined : BORROWED[g];
    if (lent) {
      const [kit, tile, tint] = lent;
      const im = this.image(tile, kit);
      return im ? { im, tint, piece: `${kit}/${tile}` } : null;
    }
    const gt = groundTile(g, road, false);
    const piece = this.kit.tiles[gt.tile];
    const im = this.image(piece);
    return im ? { im, tint: gt.tint, piece } : null;
  }

  /** The column's two sides and lip, taken from the colours of the tile's own slab edge so they sit under it. */
  sidesOf(piece: string, im: HTMLImageElement): [string, string, string] {
    const key = `${this.kit.name}:${piece}`;
    const had = this.sides.get(key);
    if (had) return had;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0);
    // (the slab's edge: low on the picture, a quarter and three quarters across; the nearest opaque pixel upward)
    const pick = (fx: number, shade: number): string => {
      const x = Math.floor(c.width * fx);
      for (let y = c.height - 2; y > c.height / 2; y--) {
        const d = g.getImageData(x, y, 1, 1).data;
        if (d[3] > 200) return `rgb(${Math.round(d[0] * shade)},${Math.round(d[1] * shade)},${Math.round(d[2] * shade)})`;
      }
      return '#5f412a';
    };
    const out: [string, string, string] = [pick(0.25, 0.9), pick(0.75, 0.7), pick(0.25, 1.1)];
    this.sides.set(key, out);
    return out;
  }
}
