// Draws iso/isoCastle.ts's plan: the castle's or the hold's pieces as sprites in the view's `things`, sorted among the
// buildings and the townsfolk. Only the drawing: iso/isoView.ts feeds it the snapshot's castle and finished rooms, and
// the textures it loads (a piece fetched the first time it is wanted).

import { Container, Sprite, type Texture } from 'pixi.js';
import type { Building } from '../../shared/sim/state';
import { footBase, footWidth, type Rect } from './isoMath';
import { castlePeopleOf, castleUrl, pieceScale, planCastle, PIECE_ID, type CastlePeople, type CastleShape, type Placed } from './isoCastle';

export interface CastleIn extends CastleShape {
  hold: 'castle' | 'mountain';
}

export class IsoCastleView {
  private readonly sprites: { sprite: Sprite; id?: number }[] = [];
  private key = '';
  /** The people whose castle is drawn (null: none, and every other building draws as it did). */
  people: CastlePeople | null = null;

  /** `get` loads a texture by URL (null until it has arrived); `k0` is the kit's own scale (`kit.scale` times
   *  `ISO_ART`). Returns false while nothing is drawn. */
  constructor(
    private readonly things: Container,
    private readonly own: Set<Container>,
    private readonly get: (url: string) => Texture | null,
  ) {}

  /** The castle again from the snapshot (nothing when the town has none). Rooms are the finished ones. */
  sync(castle: CastleIn | null, list: Building[], landW: number, footprint: (b: Building) => Rect, ox: number, k0: number, gen: number): void {
    const people = castle ? castlePeopleOf(castle.hold) : null;
    this.people = people;
    const rooms = castle ? list.filter((b) => b.room && b.status === 'done') : [];
    const key = castle && people ? `${people}|${castle.core.x},${castle.core.y}|${castle.gate.x},${castle.gate.y}|${JSON.stringify(castle.gates ?? [])}|${rooms.map((b) => `${b.id}:${b.tile},${b.row},${b.def}`).join(';')}|${k0}|${ox}|${gen}` : '';
    if (key === this.key) return;
    this.key = key;
    let plan: Placed[] = [];
    if (castle && people) {
      plan = planCastle(
        castle,
        rooms.map((b) => ({ id: b.id, def: b.def, foot: footprint(b) })),
        landW,
      );
    }
    let used = 0;
    for (const p of plan) {
      const id = PIECE_ID[people!][p.piece];
      const tex = this.get(castleUrl(people!, id));
      if (!tex) continue;
      let e = this.sprites[used];
      if (!e) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5, 1);
        this.things.addChild(sprite);
        this.own.add(sprite);
        e = { sprite, id: undefined };
        this.sprites.push(e);
      }
      used++;
      const s = e.sprite;
      s.visible = true;
      s.texture = tex;
      e.id = p.id;
      const k = pieceScale(p.piece, tex.width, tex.height, footWidth(p.foot), k0);
      s.scale.set(p.flip ? -k : k, k);
      const at = footBase(p.foot, ox);
      s.position.set(Math.round(at.x), Math.round(at.y));
      s.zIndex = p.depth;
    }
    for (let i = used; i < this.sprites.length; i++) {
      this.sprites[i].sprite.visible = false;
      this.sprites[i].id = undefined;
    }
  }

  /** The room whose piece is under a view point (px on the diamonds), front-most first. */
  roomAt(x: number, y: number): number | null {
    let best: { id: number; z: number } | null = null;
    for (const { sprite: s, id } of this.sprites) {
      if (id === undefined || !s.visible) continue;
      const w = s.width;
      if (x < s.x - w / 2 || x > s.x + w / 2 || y < s.y - s.height || y > s.y) continue;
      if (!best || s.zIndex > best.z) best = { id, z: s.zIndex };
    }
    return best?.id ?? null;
  }
}

