// The raid board in the isometric look (the Settings switch, iso/isoSetting.ts): the tile tops are the town's people's
// kit ground tiles and the wall, the gate and the towers on it are the kit's pieces (iso/isoKits.ts). The kit's
// pictures are loaded by URL the first time they're wanted. With the switch off nothing here is used.

import { Texture } from 'pixi.js';
import { loadImage } from '../art/loadImage';
import { groundTile, kitNameFor, kitOf, kitUrl, pieceFor, type Kit } from '../iso/isoKits';
import type { Ground } from '../../shared/sim/land';

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
  image(piece: string): HTMLImageElement | null {
    const url = kitUrl(this.kit.name, piece);
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

  texture(piece: string): Texture | null {
    const im = this.image(piece);
    if (!im) return null;
    const url = kitUrl(this.kit.name, piece);
    let t = this.texs.get(url);
    if (!t) this.texs.set(url, (t = Texture.from(im)));
    return t;
  }

  /** The piece for a building (a wall, a gate, a tower), by its def. */
  piece(def: string): string {
    return pieceFor(this.kit, def);
  }

  /** The ground tile of a board tile and its tint (null while it loads). */
  top(g: Ground, road: boolean): { im: HTMLImageElement; tint: number; piece: string } | null {
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
