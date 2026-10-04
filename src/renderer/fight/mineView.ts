// Inside a mine (the owner's ask: tap a cave dug as a mine and go in to watch the digging). The town's own view gives
// way to the cave scene (the fight backdrop's `cave`, seen side-on): the galleries' walls across the back, each wall
// cell of the mine a seam of ore drawn in its colour with what's left of it, the diggers at their seams swinging their
// picks (the LPC slash with the pick layer, art/held.ts), dust where the pick lands, and the ones still on their way
// walking in from the left. `snapshot.mine` (sim/snapshot.ts MineView) is what's drawn; the HUD (fightHud.ts `mine`)
// names the mine, its level and what its walls hold.
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { Material } from '../../shared/data/materials';
import type { MineView } from '../../shared/sim/snapshot';
import { BACK_H, BACK_HORIZON, BACK_W, fightBackdrop, FRONT_H, type Backdrop } from '../art/fightBackdrop';
import { wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame } from '../art/lpc/lpc';

const SEE_W = 320;
const SEE_H = 180;
/** The cave is never shown taller than this (art px): upright the rest of the room stays dark. */
const TALLEST = 240;
/** Each ore's colour in the rock (the seams), and the stone itself. */
const ORE_COLOUR: Partial<Record<Material, number>> = { copper_ore: 0xc8743a, tin_ore: 0xb8c0c8, silver_ore: 0xe8ecf4, sulphur: 0xe0d050, gold: 0xf0c020, gems: 0x60d0c0, stone: 0x8a8a94, iron_ore: 0x9a6a5a, coal: 0x303038 };
/** How wide a seam is drawn, and how far apart the seams stand. */
const SEAM_W = 30;
const SEAM_GAP = 36;
/** A pick's swing, in ms a cycle. */
const SWING_MS = 1100;

interface Digger {
  sprite: Sprite;
  dust: Graphics;
  x: number;
}

export class MineScene {
  readonly root = new Container();
  private readonly cover = new Graphics();
  private readonly clip = new Graphics();
  private readonly world = new Container();
  private readonly layers = [new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: FRONT_H })];
  private readonly seams = new Graphics();
  private readonly figures = new Container();
  private readonly dark = new Graphics();
  private backdrop: Backdrop | null = null;
  private vw = SEE_W;
  private vh = SEE_H;
  private hy = SEE_H - 50;
  private view: MineView | null = null;
  private sceneId = -1;
  private readonly diggers = new Map<number, Digger>();
  /** Where each seam stands (art px), by wall cell, and the view's scroll so the seams fit. */
  private seamX = new Map<number, number>();
  private scroll = 0;

  constructor() {
    this.root.visible = false;
    this.world.addChild(...this.layers.slice(0, 3), this.seams, this.layers[3], this.figures, this.dark);
    this.world.mask = this.clip;
    this.root.addChild(this.clip, this.cover, this.world);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  resize(w: number, h: number, top: number, bottom: number): void {
    const room = Math.max(40, h - top - bottom);
    this.cover.clear().rect(0, 0, w, h).fill(0x08081e);
    const k = Math.max(1, Math.min(w / SEE_W, room / SEE_H));
    this.vw = w / k;
    // (upright the room is tall: the cave is kept to a band and stood in the middle, dark above and below)
    this.vh = Math.min(room / k, TALLEST);
    const pad = Math.round((room - this.vh * k) / 2);
    this.hy = Math.round(this.vh - Math.min(this.vh * 0.5, 50));
    this.world.scale.set(k);
    this.world.position.set(0, top + pad);
    this.clip.clear().rect(0, top + pad, w, Math.round(this.vh * k)).fill(0xffffff);
    for (const l of this.layers) l.width = this.vw + 2;
    for (const l of this.layers.slice(0, 3)) l.y = this.hy - BACK_HORIZON;
    this.layers[3].y = Math.round(this.vh - FRONT_H + 8);
  }

  update(v: MineView | null): void {
    this.root.visible = !!v;
    this.view = v;
    if (!v) return;
    if (v.id !== this.sceneId) {
      this.sceneId = v.id;
      const art = fightBackdrop('cave', v.id);
      this.backdrop = art;
      [art.far, art.mid, art.near, art.front].forEach((a, i) => (this.layers[i].texture = a.texture));
      for (const d of this.diggers.values()) {
        d.sprite.destroy();
        d.dust.destroy();
      }
      this.diggers.clear();
      this.scroll = 0;
    }
  }

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v || !this.backdrop) return;
    // the seams across the back wall, centred (and scrolling slowly across when there are more than fit)
    const n = v.walls.length;
    const span = (n - 1) * SEAM_GAP;
    const want = Math.max(0, (span + SEAM_W - this.vw) / 2);
    this.scroll += (want * Math.sin(now / 9000) - this.scroll) * Math.min(1, dt * 0.6);
    const left = this.vw / 2 - span / 2 - this.scroll;
    const g = this.seams.clear();
    this.seamX.clear();
    v.walls.forEach((w, i) => {
      const x = Math.round(left + i * SEAM_GAP);
      this.seamX.set(w.cell, x);
      const total = Object.values(w.left).reduce((a, b) => a + (b ?? 0), 0);
      // the rock face: a dark slab with the ores' flecks over it (the more left, the more flecks)
      const top = this.hy - 46;
      g.roundRect(x - SEAM_W / 2, top, SEAM_W, 44, 3).fill({ color: 0x3a3844, alpha: 0.9 });
      g.roundRect(x - SEAM_W / 2 + 2, top + 2, SEAM_W - 4, 40, 2).stroke({ color: 0x504e5c, width: 1 });
      let k = 0;
      for (const [m, left] of Object.entries(w.left) as [Material, number][]) {
        if (m === 'stone' || !left) continue;
        const col = ORE_COLOUR[m] ?? 0xffffff;
        const flecks = Math.min(14, Math.ceil(left * 1.5));
        for (let f = 0; f < flecks; f++) {
          // (a fixed scatter per seam and ore: the flecks don't crawl between frames)
          const h = (((w.cell * 31 + k * 17 + f * 13) * 2654435761) >>> 0) / 4294967296;
          const h2 = (((w.cell * 7 + k * 29 + f * 41) * 2246822519) >>> 0) / 4294967296;
          g.rect(x - SEAM_W / 2 + 3 + Math.floor(h * (SEAM_W - 8)), top + 4 + Math.floor(h2 * 34), 2, 2).fill(col);
        }
        k++;
      }
      if (!total) g.rect(x - SEAM_W / 2 + 3, top + 20, SEAM_W - 6, 2).fill({ color: 0x1a1820, alpha: 0.8 }); // (dug out: a dark gallery mouth)
      // what's left, as a thin bar under the seam
      const most = Math.max(1, ...v.walls.map((q) => Object.values(q.left).reduce((a, b) => a + (b ?? 0), 0)));
      g.rect(x - SEAM_W / 2, this.hy - 1, SEAM_W, 2).fill(0x202028);
      g.rect(x - SEAM_W / 2, this.hy - 1, Math.round((SEAM_W * total) / most), 2).fill(total ? 0xd0b060 : 0x404048);
    });
    // the diggers: at their seams swinging, else walking in from the left
    const seen = new Set<number>();
    const k = 0.75;
    v.miners.forEach((m, i) => {
      seen.add(m.id);
      let d = this.diggers.get(m.id);
      if (!d) {
        const sprite = new Sprite();
        const dust = new Graphics();
        this.figures.addChild(sprite, dust);
        d = { sprite, dust, x: -20 - i * 14 };
        this.diggers.set(m.id, d);
      }
      const wall = v.walls.find((w) => w.digger?.id === m.id);
      const at = wall ? (this.seamX.get(wall.cell) ?? this.vw / 2) - 10 : this.vw / 2 - 40 + i * 16;
      const phase = (now / SWING_MS + i * 0.37) % 1;
      if (m.digging && wall) {
        d.x = at;
        const frame = Math.floor(phase * FRAME_COUNT.slash) % FRAME_COUNT.slash;
        d.sprite.texture = lpcFrame(m.look, 'slash', frame, 'pick', wornLayers(m.gear));
        // dust where the pick lands (the swing's end), a puff that spreads and fades
        d.dust.clear();
        if (phase > 0.55 && phase < 0.95) {
          const t = (phase - 0.55) / 0.4;
          d.dust.circle(at + 14 + t * 4, this.hy - 20 - t * 6, 2 + t * 5).fill({ color: 0xa09888, alpha: 0.5 * (1 - t) });
          d.dust.circle(at + 18, this.hy - 14 - t * 10, 1.5 + t * 3).fill({ color: 0xc0b8a8, alpha: 0.4 * (1 - t) });
        }
      } else {
        // (walking in: from the left to the middle, then standing by)
        d.x = Math.min(at, d.x + dt * 28);
        const walking = d.x < at - 0.5;
        const frame = walking ? 1 + (Math.floor(now / 100 + i * 3) % 8) : 0;
        d.sprite.texture = lpcFrame(m.look, 'walk', frame, 'pick', wornLayers(m.gear));
        d.dust.clear();
      }
      d.sprite.scale.set(k);
      d.sprite.position.set(Math.round(d.x - CENTRE_X * k), Math.round(this.hy + 10 - FEET_Y * k));
      d.sprite.zIndex = i;
    });
    for (const [id, d] of this.diggers)
      if (!seen.has(id)) {
        d.sprite.destroy();
        d.dust.destroy();
        this.diggers.delete(id);
      }
    // the dark of the deep: a little dimmer each level down
    this.dark.clear();
    const dim = Math.min(0.35, (v.depth - 1) * 0.1);
    if (dim > 0) this.dark.rect(0, 0, this.vw, this.vh).fill({ color: 0x05040a, alpha: dim });
  }
}
