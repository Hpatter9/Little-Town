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

/** A street light of the town's (snapshot.lights, the ones on no room). */
export interface StreetLight {
  id: number;
  x: number;
  y: number;
  lit: boolean;
}

interface Lamp {
  post: Container;
  glow: Sprite;
  rank: number;
  phase: number;
  /** The town's light it stands for (sim/lighting.ts), when the town keeps them. */
  id?: number;
}

export class StreetLamps {
  private tex: Texture | null = null;
  private lamps: Lamp[] = [];
  private key = '';
  private roads = '';
  private lit = 0;
  private t = 0;
  calm = false;
  private last: { land: LandMap; era: Era; lights?: StreetLight[] | null } | null = null;
  /** Which of the town's lights burn (by id): a lamp unfed stands dark. */
  private burning: Set<number> | null = null;

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
  sync(land: LandMap, era: Era, lights: StreetLight[] | null = null): void {
    this.last = { land, era, lights };
    this.burning = lights ? new Set(lights.filter((l) => l.lit).map((l) => l.id)) : null;
    // (only when the streets, the age or the picture change: the land's version moves with every log gathered)
    const key = `${era}|${!!this.tex}|${land.camp.x},${land.camp.y}|${lights ? lights.map((l) => `${l.id}:${l.x},${l.y}`).join(';') : '-'}`;
    if (key === this.key && land.roads === this.roads) return;
    this.key = key;
    this.roads = land.roads;
    for (const l of this.lamps) {
      l.post.destroy({ children: true });
      l.glow.destroy();
    }
    this.lamps = [];
    const look = LAMP_LOOK[era];
    // (the town's own street lights where it keeps them, else a lamp every few cells of road)
    const cells: { x: number; y: number; side: 1 | -1; id?: number }[] = lights
      ? lights.map((l) => ({ x: l.x, y: l.y, side: isRoad(land, l.x + 1, l.y) && !isRoad(land, l.x - 1, l.y) ? -1 : 1, id: l.id }))
      : lampCells(land, (x, y) => isRoad(land, x, y));
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
      this.lamps.push({ post, glow, rank: rank / Math.max(1, cells.length), phase: (c.x * 7 + c.y * 13) % 10, id: c.id });
    });
  }

  /** How dark it is (per snapshot): the lamps are lit in turn as dusk falls. */
  setDaylight(daylight: number): void {
    this.lit = lampLit(daylight);
  }

  /** The lamps burning now (where their flames are, world px): the moths come to them (map/mapCritters.ts). */
  litGlows(): { x: number; y: number }[] {
    return this.lamps.filter((l) => l.glow.visible).map((l) => ({ x: l.glow.x, y: l.glow.y + 26 }));
  }

  render(dt: number): void {
    this.t += dt;
    for (const l of this.lamps) {
      const on = l.rank < this.lit && (l.id === undefined || !this.burning || this.burning.has(l.id));
      l.glow.visible = on;
      if (on) l.glow.alpha = this.calm ? 0.8 : 0.72 + 0.12 * Math.sin(this.t * 7 + l.phase) * Math.sin(this.t * 3.1 + l.phase * 2);
    }
  }
}
