// Signposts at the town's crossroads (the owner's ask): the Fields pack's wooden posts, a board pointing each way that
// leads somewhere, naming the country it heads toward and the rival towns that lie that way (map/signRules.ts). East
// boards are the pack's post with its board to the right, west boards the one to the left, more boards a side the
// pack's loose plank lower down. Tap one for what the boards say.

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL, type LandMap } from '../../shared/sim/land';
import { regionTitle } from '../../shared/sim/landRegions';
import type { RealmView } from '../../shared/sim/factions';
import { loadImage } from '../art/loadImage';
import rightUrl from '../art/packs/f_pointer4.png';
import leftUrl from '../art/fields/pointer1.png';
import boardUrl from '../art/fields/board.png';
import { boardsFor, crossroads, townBearing, type Place, type Signpost } from './signRules';

/** Where each picture's post stands (px from its left), and the posts' size on the map. */
const RIGHT_POST = 8;
const LEFT_POST = 14;
const SCALE = 1;

export class Signposts {
  private tex: { right?: Texture; left?: Texture; board?: Texture } = {};
  readonly drawn: { c: Container; s: Signpost }[] = [];
  private key = '';

  constructor(private readonly layer: Container) {
    Promise.all([loadImage(rightUrl), loadImage(leftUrl), loadImage(boardUrl)])
      .then(([r, l, b]) => {
        const t = (im: HTMLImageElement) => {
          const x = Texture.from(im);
          x.source.scaleMode = 'nearest';
          return x;
        };
        this.tex = { right: t(r), left: t(l), board: t(b) };
        this.key = '';
      })
      .catch(() => undefined);
  }

  /** The places a board may name: the land's regions beyond the vale, and the realm's towns that still stand. */
  static places(land: LandMap, realm: RealmView): Place[] {
    const out: Place[] = (land.regions ?? []).filter((r) => r.kind !== 'vale').map((r) => ({ name: regionTitle(r), bearing: null, x: r.x, y: r.y, town: false }));
    for (const f of realm.factions) {
      if (!f.known || f.folk <= 0) continue;
      out.push({ name: `${f.stronghold}, ${f.name.replace(/^The /, 'the ')}'s ${f.size}`, bearing: townBearing(f.id), x: 0, y: 0, town: true });
    }
    return out;
  }

  /** The posts at the crossroads as they are (`stamp` changes when what stands about them may have: the buildings). */
  sync(land: LandMap, realm: RealmView, free: (x: number, y: number) => boolean, stamp = ''): void {
    if (!this.tex.right) return;
    const places = Signposts.places(land, realm);
    const key = `${stamp}|${land.version}|${land.roads.length}|${hashRoads(land.roads)}|${places.map((p) => p.name).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    for (const d of this.drawn) d.c.destroy({ children: true });
    this.drawn.length = 0;
    for (const x of crossroads(land, free)) {
      const boards = boardsFor(x, x.legs, places);
      if (!boards.length) continue;
      const s: Signpost = { x: x.x, y: x.y, postX: x.postX, postY: x.postY, boards };
      const c = this.layer.addChild(new Container());
      const fx = (s.postX + 0.5) * CELL;
      const fy = (s.postY + 0.5) * CELL + 8;
      c.position.set(Math.round(fx), Math.round(fy));
      c.zIndex = fy;
      const east = boards.filter((b) => b.dx > 0 || (b.dx === 0 && b.dy < 0));
      const west = boards.filter((b) => !east.includes(b));
      // (the post itself: with its first board to the east, else to the west)
      const main = east.length ? this.tex.right! : this.tex.left!;
      const post = c.addChild(new Sprite(main));
      post.anchor.set((east.length ? RIGHT_POST : LEFT_POST) / main.width, 1);
      post.scale.set(SCALE);
      if (east.length && west.length) {
        const other = c.addChild(new Sprite(this.tex.left!));
        other.anchor.set(LEFT_POST / this.tex.left!.width, 1);
        other.scale.set(SCALE);
        other.y = 5; // (the second board a little lower, on the same post)
      }
      // (more boards a side: the loose plank, lower on the post)
      const extra = [...east.slice(1).map(() => 1), ...west.slice(1).map(() => -1)];
      extra.forEach((side, i) => {
        const b = c.addChild(new Sprite(this.tex.board!));
        b.anchor.set(side > 0 ? 0 : 1, 0.5);
        b.scale.set(side * 0.8 * SCALE, 0.8 * SCALE);
        b.position.set(side * 1, -22 + i * 5);
      });
      this.drawn.push({ c, s });
    }
  }

  /** The signpost under a world point (px), if any. */
  signAt(wx: number, wy: number): Signpost | null {
    for (const d of this.drawn) if (Math.abs(wx - d.c.x) < 12 && wy < d.c.y + 2 && wy > d.c.y - 38) return d.s;
    return null;
  }

  /** What a signpost's boards say, a line a board. */
  static lines(s: Signpost): string[] {
    return s.boards.map((b) => `${b.dir[0].toUpperCase()}${b.dir.slice(1)}: ${b.names.join('; ')}`);
  }
}

/** A cheap fingerprint of the roads (they change as streets are laid). */
function hashRoads(roads: string): number {
  let h = 0;
  for (let i = 0; i < roads.length; i++) if (roads.charCodeAt(i) === 35) h = (h * 31 + i) | 0;
  return h;
}
