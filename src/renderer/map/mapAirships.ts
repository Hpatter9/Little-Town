// The skies on the map (sim/skies.ts): the town's airships moored at the mast (her nose made fast to the mast's head,
// riding the wind beside it), flying out over the town as a party sets off and home again as it returns, and the sky
// pirates' black ship coming in over the town and hanging over the raid it dropped, ropes trailing down. Each ship
// casts a shadow on the land below her. The pictures are art/airshipArt.ts (the packs' airships, recoloured).

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import type { Snapshot } from '../../shared/sim/snapshot';
import { airshipTexture, loadAirshipArt, NOSE, type ShipLook } from '../art/airshipArt';

/** The mast's picture is this tall for its width (packBuildings.ts's mast), and its head this far across it. */
const MAST_TALL = 192 / 140;
const MAST_HEAD = 0.71;
/** How high a moored ship rides, and how high one climbs as she leaves (px over the ground). */
const MOORED_HIGH = 0.62;
const CRUISE_HIGH = 190;
/** How far she flies off the side of the view as she leaves (px), and the pirates come in from. */
const FLY_OFF = 1100;

interface Ship {
  sprite: Sprite;
  shadow: Sprite;
  ropes: Graphics;
  look: ShipLook;
  flip: boolean;
  /** Where she is (px: the spot on the ground below her) and how high, eased toward the target. */
  x: number;
  y: number;
  high: number;
  tx: number;
  ty: number;
  th: number;
  n: number;
  moored: boolean;
  ropesTo: { x: number; y: number } | null;
  seen: boolean;
}

export class MapAirships {
  private readonly ships = new Map<string, Ship>();
  private ready = false;

  /** `things` for the moored (sorted among the buildings), `over` for those flying, `under` for the shadows. */
  constructor(private readonly things: Container, private readonly over: Container, private readonly under: Container) {
    void loadAirshipArt().then(() => (this.ready = true));
  }

  update(ships: Snapshot['airships'], mast: Snapshot['mast'], pirates: Snapshot['skyPirates']): void {
    if (!this.ready) return;
    for (const s of this.ships.values()) s.seen = false;
    if (mast) {
      const w = mast.w * CELL;
      const foot = (mast.y + mast.h) * CELL;
      const head = { x: mast.x * CELL + w * MAST_HEAD, y: foot - w * MAST_TALL };
      let moored = 0;
      for (const a of ships) {
        if (a.away !== null && !a.leg) continue;
        const k = `a${a.id}`;
        const at = this.ship(k, a.kind as ShipLook, a.id);
        if (a.away === null) {
          // (moored: her nose at the mast's head, riding out beside it, each further down the wind)
          const tex = at.sprite.texture;
          // (her nose at the mast's head: her foot hangs that much below it)
          const high = foot + 6 - (head.y + tex.height * (1 - NOSE[at.look][1])) - moored * 14;
          at.tx = head.x - tex.width * NOSE[at.look][0] + tex.width / 2 + moored * 12;
          at.ty = foot + 6 + moored * 10;
          at.th = high;
          at.moored = true;
          at.flip = false;
          moored++;
        } else if (a.leg) {
          // (leaving: up from the mast and off toward where she's bound; coming home, the other way)
          const t = a.leg.phase === 'out' ? a.leg.share : 1 - a.leg.share;
          at.tx = head.x + a.leg.side * t * FLY_OFF;
          at.ty = foot + 6 + t * 60;
          at.th = (foot - head.y) * MOORED_HIGH + t * (CRUISE_HIGH - (foot - head.y) * MOORED_HIGH);
          at.moored = false;
          at.flip = (a.leg.phase === 'out' ? a.leg.side : -a.leg.side) > 0;
        }
        at.seen = true;
      }
    }
    if (pirates) {
      const at = this.ship('pirates', 'pirates', 7);
      const t = pirates.phase === 'coming' ? pirates.share : 1;
      at.tx = pirates.x - (1 - t) * FLY_OFF;
      at.ty = pirates.y;
      at.th = pirates.phase === 'over' ? 130 : 170;
      at.flip = true;
      at.moored = false;
      at.ropesTo = pirates.phase === 'over' ? { x: pirates.x, y: pirates.y } : null;
      at.seen = true;
    }
    for (const [k, s] of this.ships) {
      if (s.seen) continue;
      s.sprite.destroy();
      s.shadow.destroy();
      s.ropes.destroy();
      this.ships.delete(k);
    }
  }

  private ship(key: string, look: ShipLook, n: number): Ship {
    let s = this.ships.get(key);
    if (!s || s.look !== look) {
      if (s) {
        s.sprite.destroy();
        s.shadow.destroy();
        s.ropes.destroy();
      }
      const sprite = new Sprite(airshipTexture(look) as Texture);
      sprite.anchor.set(0.5, 1);
      const shadow = this.under.addChild(new Sprite(airshipTexture(look, 1, false, 0.22) as Texture));
      shadow.anchor.set(0.5, 0.5);
      const ropes = this.over.addChild(new Graphics());
      s = { sprite, shadow, ropes, look, flip: false, x: NaN, y: NaN, high: 0, tx: 0, ty: 0, th: 0, n, moored: false, ropesTo: null, seen: true };
      this.ships.set(key, s);
    }
    return s;
  }

  /** Each frame: ease them toward where they're bound, rock them on the wind, and lay their shadows. */
  render(now: number, wind = 0.3): void {
    for (const s of this.ships.values()) {
      if (Number.isNaN(s.x)) {
        s.x = s.tx;
        s.y = s.ty;
        s.high = s.th;
      }
      s.x += (s.tx - s.x) * 0.08;
      s.y += (s.ty - s.y) * 0.08;
      s.high += (s.th - s.high) * 0.08;
      // (moored among the buildings, sorted by the mast's foot; flying, over everything)
      const parent = s.moored ? this.things : this.over;
      if (s.sprite.parent !== parent) parent.addChild(s.sprite);
      const tex = airshipTexture(s.look, 1, s.flip);
      if (tex && s.sprite.texture !== tex) s.sprite.texture = tex;
      const bob = Math.sin(now / 900 + s.n) * 2 + Math.sin(now / 2300 + s.n * 3) * wind * 3;
      s.sprite.position.set(Math.round(s.x), Math.round(s.y - s.high + bob));
      s.sprite.rotation = s.moored ? Math.sin(now / 1700 + s.n) * 0.02 * (0.5 + wind) : 0;
      s.sprite.zIndex = s.moored ? s.y : 0;
      // (her shadow on the ground below, a little behind as the sun is)
      const st = airshipTexture(s.look, 1, s.flip, 0.22);
      if (st && s.shadow.texture !== st) s.shadow.texture = st;
      s.shadow.position.set(Math.round(s.x + s.high * 0.25), Math.round(s.y));
      s.shadow.scale.set(1, 0.45);
      s.shadow.alpha = Math.max(0.3, 1 - s.high / 400);
      // (the pirates' ropes down to the town)
      s.ropes.clear();
      if (s.ropesTo) {
        const bx = s.sprite.x;
        const by = s.sprite.y - 6;
        for (let i = -1; i <= 1; i++) {
          const sway = Math.sin(now / 600 + i * 2) * 5;
          s.ropes.moveTo(bx + i * 14, by).quadraticCurveTo(bx + i * 10 + sway, (by + s.ropesTo.y) / 2, s.ropesTo.x + i * 16, s.ropesTo.y).stroke({ width: 1, color: 0x2a1e14, alpha: 0.85 });
        }
      }
    }
  }

  /** The ship under a point (world px), if any: its key ('a<id>' or 'pirates'). */
  shipAt(wx: number, wy: number): string | null {
    for (const [k, s] of this.ships) {
      const w = s.sprite.width / 2;
      const top = s.sprite.y - s.sprite.height;
      if (Math.abs(wx - s.sprite.x) <= w && wy >= top && wy <= s.sprite.y) return k;
    }
    return null;
  }
}
