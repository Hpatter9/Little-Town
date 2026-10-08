// Lamps along the streets (the owner's ask: street lamps by the age, lit at dusk): every few cells of road a post
// stands at the roadside: a torch on a stake in the Stone Age, the Village pack's lantern post from the Medieval age (an
// iron gas lamp in the Industrial age, a cool electric light after), and as dusk falls they're lit one after another out
// from the fire, as a lamplighter would go round, and put out at dawn. The posts stand among the things; their glows
// are in the map's lights layer and flicker. None on a slow phone's flicker (`calm`).

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Era } from '../../shared/data/eras';
import { CELL, isRoad, type LandMap } from '../../shared/sim/land';
import { loadImage } from '../art/loadImage';
import lampUrl from '../art/packs/v_lamp.png';
import { glowTexture } from '../town/layer';
import { lampCells, lampLit, LAMP_LOOK } from './lampRules';

interface Lamp {
  post: Container;
  glow: Sprite;
  rank: number;
  phase: number;
}

export class StreetLamps {
  private tex: Texture | null = null;
  private lamps: Lamp[] = [];
  private key = '';
  private roads = '';
  private lit = 0;
  private t = 0;
  calm = false;
  private last: { land: LandMap; era: Era } | null = null;

  constructor(private readonly layer: Container, private readonly lights: Container) {
    loadImage(lampUrl)
      .then((im) => {
        this.tex = Texture.from(im);
        this.tex.source.scaleMode = 'nearest';
        this.key = '';
        if (this.last) this.sync(this.last.land, this.last.era);
      })
      .catch(() => undefined);
  }

  /** The posts for the land's streets and the age (redone when the roads change). */
  sync(land: LandMap, era: Era): void {
    this.last = { land, era };
    // (only when the streets, the age or the picture change: the land's version moves with every log gathered)
    const key = `${era}|${!!this.tex}|${land.camp.x},${land.camp.y}`;
    if (key === this.key && land.roads === this.roads) return;
    this.key = key;
    this.roads = land.roads;
    for (const l of this.lamps) {
      l.post.destroy({ children: true });
      l.glow.destroy();
    }
    this.lamps = [];
    const look = LAMP_LOOK[era];
    const cells = lampCells(land, (x, y) => isRoad(land, x, y));
    cells.forEach((c, rank) => {
      const x = c.x * CELL + (c.side > 0 ? CELL - 3 : 3);
      const y = c.y * CELL + CELL - 4;
      const post = this.layer.addChild(new Container());
      if (look.kind === 'torch' || !this.tex) {
        // (a torch on a stake: a pole, a wrapped head, its flame drawn by the glow)
        const g = post.addChild(new Graphics());
        g.rect(-1, -22, 2, 22).fill(0x5a3a20);
        g.rect(-2, -26, 4, 5).fill(0x3a2a18);
        g.circle(0, -28, 2.5).fill(0xffa030);
        g.circle(0, -29, 1.3).fill(0xfff0a0);
      } else {
        const sp = post.addChild(new Sprite(this.tex));
        sp.anchor.set(0.5, 1);
        sp.scale.set(0.8);
        if (look.tint !== 0xffffff) sp.tint = look.tint;
      }
      post.position.set(x, y);
      post.zIndex = y;
      const glow = this.lights.addChild(new Sprite(glowTexture()));
      glow.anchor.set(0.5);
      glow.position.set(x, y - (look.kind === 'torch' ? 26 : 26));
      glow.width = glow.height = look.radius * 2;
      glow.tint = look.light;
      glow.visible = false;
      this.lamps.push({ post, glow, rank: rank / Math.max(1, cells.length), phase: (c.x * 7 + c.y * 13) % 10 });
    });
  }

  /** How dark it is (per snapshot): the lamps are lit in turn as dusk falls. */
  setDaylight(daylight: number): void {
    this.lit = lampLit(daylight);
  }

  render(dt: number): void {
    this.t += dt;
    for (const l of this.lamps) {
      const on = l.rank < this.lit;
      l.glow.visible = on;
      if (on) l.glow.alpha = this.calm ? 0.8 : 0.72 + 0.12 * Math.sin(this.t * 7 + l.phase) * Math.sin(this.t * 3.1 + l.phase * 2);
    }
  }
}
