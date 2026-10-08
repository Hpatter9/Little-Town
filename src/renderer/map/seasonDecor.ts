// The town dressed for the season (the owner's ask): by the doors of the homes and venues, a potted plant in spring and
// summer (the Glassblower pack's), gourds and a sheaf of corn at harvest-time in autumn (DawnLike's), and in winter a
// lantern (DawnLike's), glowing after dark, and a holly wreath on the door. Every other door gets its dressing, by id,
// so the street isn't all alike. Drawn among the things; the lanterns' glows in the lights layer.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { buildingDoor } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import plantUrl from '../art/shops/ap_plant.png';
import foodUrl from '../art/items/Food.png';
import lightUrl from '../art/items/Light.png';
import { glowTexture } from '../town/layer';
import { decorFor, dressed } from './decorRules';

const CELL16 = 16;

export class SeasonDecor {
  private tex: { plant?: Texture; gourds: Texture[]; sheaf?: Texture; lantern?: Texture } = { gourds: [] };
  private readonly items: Container[] = [];
  private readonly glows: Sprite[] = [];
  private key = '';
  private last: { list: Building[]; season: string } | null = null;

  constructor(private readonly layer: Container, private readonly lights: Container) {
    const cut = (base: Texture, x: number, y: number) => new Texture({ source: base.source, frame: new Rectangle(x * CELL16, y * CELL16, CELL16, CELL16) });
    Promise.all([loadImage(plantUrl), loadImage(foodUrl), loadImage(lightUrl)])
      .then(([plant, food, light]) => {
        const f = Texture.from(food);
        const l = Texture.from(light);
        for (const t of [f, l]) t.source.scaleMode = 'nearest';
        this.tex = { plant: Texture.from(plant), gourds: [cut(f, 1, 2), cut(f, 3, 2), cut(f, 5, 3)], sheaf: cut(f, 6, 3), lantern: cut(l, 3, 0) };
        this.key = '';
        if (this.last) this.sync(this.last.list, this.last.season);
      })
      .catch(() => undefined);
  }

  sync(list: Building[], season: string): void {
    this.last = { list, season };
    if (!this.tex.plant) return;
    const doors = list.filter((b) => dressed(b));
    const key = `${season}|${doors.map((b) => `${b.id}:${b.tile},${b.row}`).join(';')}`;
    if (key === this.key) return;
    this.key = key;
    for (const c of this.items) c.destroy({ children: true });
    for (const g of this.glows) g.destroy();
    this.items.length = 0;
    this.glows.length = 0;
    for (const b of doors) {
      const d = buildingDoor(b);
      const c = this.layer.addChild(new Container());
      c.position.set(Math.round(d.x), Math.round(d.y - 14));
      c.zIndex = d.y - 13;
      let side = 1;
      for (const what of decorFor(season, b.id)) {
        const put = (t: Texture | undefined, k: number) => {
          if (!t) return;
          const sp = c.addChild(new Sprite(t));
          sp.anchor.set(0.5, 1);
          sp.scale.set(k);
          sp.position.set(side * 13, 0);
          side = -side;
        };
        if (what === 'plant') put(this.tex.plant, 0.9);
        else if (what === 'gourds') put(this.tex.gourds[b.id % this.tex.gourds.length], 0.8);
        else if (what === 'sheaf') put(this.tex.sheaf, 1);
        else if (what === 'lantern') {
          put(this.tex.lantern, 0.85);
          const g = this.lights.addChild(new Sprite(glowTexture()));
          g.anchor.set(0.5);
          g.width = g.height = 30;
          g.tint = 0xffc070;
          g.alpha = 0.7;
          g.position.set(c.x - side * 13, c.y - 8);
          this.glows.push(g);
        } else if (what === 'wreath') {
          // (holly on the door: a ring of dark green with red berries and a bow)
          const w = c.addChild(new Graphics());
          w.circle(0, -14, 4).stroke({ color: 0x2a6a30, width: 2.2 });
          w.circle(-2, -11, 0.9).fill(0xd02828);
          w.circle(2, -11, 0.9).fill(0xd02828);
          w.rect(-1.5, -18.5, 3, 1.5).fill(0xc02020);
        }
      }
      this.items.push(c);
    }
  }
}
