// Weathervanes and wind chimes (the owner's ask): a few pitched roofs carry an iron weathervane on a pole at the ridge,
// its arrow swinging round into the wind and turned by the gusts (map/airRules.ts `hasVane`, `vaneAngle`, the arrow
// foreshortened as it turns about its pole); some homes hang a wind chime under the eave, its tubes swaying in the
// wind, glinting and ringing softly when a gust comes through and the view is near (`hasChime`, `gustAt`,
// `chimeRings`: the `windchime` cue in ambience.ts through `onChime`). No pack has a weathervane or a chime, so they are
// drawn here, small and dark as ironwork against the roof; the glint is the 5000 Pixel Effects pack's white sparkle.
// They stand among the things, over their building. The vanes and chimes stand on a slow phone too; they hold still.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Building } from '../../shared/sim/state';
import { pixelFxFrame, pixelFxFrames } from '../art/effects';
import { CHIME_GAP, CHIME_NEAR_VIEW, CHIME_ON, chimeRings, gustAt, hasChime, hasVane, VANE_ON, vaneAngle } from './airRules';
import type { MapView } from './mapView';

/** How tall a vane's pole stands over the ridge, and how long its arrow (px). */
const POLE = 9;
const ARROW = 13;
/** How big they're drawn over the map's buildings (the roofs are drawn at about 1.5 to the map's px). */
const VANE_K = 1.5;
const CHIME_K = 1.3;
const IRON = 0x2a2624;
const IRON_LIT = 0x5a5450;
const BRASS = [0xd8c070, 0xc0c8cc, 0xb8a060, 0xd0d4d8];

interface Vane {
  root: Container;
  arrow: Graphics;
  phase: number;
  x: number;
  y: number;
}
interface Chime {
  root: Container;
  tubes: Graphics[];
  glint: Sprite;
  phase: number;
  x: number;
  y: number;
  gust: number;
  glintAge: number;
}

export class MapVanes {
  private readonly vanes = new Map<number, Vane>();
  private readonly chimes = new Map<number, Chime>();
  private t = 0;
  private lastRing = -1e9;
  /** The town's look (main.ts: the theme id): the tent-dwelling peoples' homes carry no vane. */
  style = 'town';
  /** For previews (`window.__wide.vanes.all`): a vane and a chime on every building that may carry one. */
  all = false;
  /** Heard when a chime rings (where across the screen, -1 left to 1 right). */
  onChime?: (pan: number) => void;

  constructor(
    private readonly things: Container,
    private readonly map: MapView,
  ) {}

  /** Each snapshot: the finished buildings, and where each is drawn (MapView `pictureOf`, `fronts`). */
  sync(buildings: readonly Building[]): void {
    const fronts = this.map.fronts();
    const seenV = new Set<number>();
    const seenC = new Set<number>();
    for (const b of buildings) {
      if (b.status !== 'done' || b.room || b.id < 0) continue;
      const pic = this.map.pictureOf(b.id);
      if (!pic) continue;
      if (hasVane(b.id, b.def, this.style) || (this.all && VANE_ON.has(b.def))) {
        seenV.add(b.id);
        let v = this.vanes.get(b.id);
        if (!v) {
          v = this.makeVane(b.id);
          this.vanes.set(b.id, v);
        }
        v.x = Math.round(pic.x + pic.w / 2);
        v.y = Math.round(pic.top + 2);
        v.root.position.set(v.x, v.y);
        v.root.zIndex = pic.y + pic.h + 0.3;
      }
      if (hasChime(b.id, b.def) || (this.all && CHIME_ON.has(b.def))) {
        seenC.add(b.id);
        let c = this.chimes.get(b.id);
        if (!c) {
          c = this.makeChime(b.id);
          this.chimes.set(b.id, c);
        }
        // (under the eave at the front, beside the first window, else a little in from the left)
        const win = fronts.get(b.id)?.windows[0];
        c.x = Math.round(win ? win.x - 9 : pic.x + pic.w * 0.22);
        c.y = Math.round(win ? win.y - 9 : pic.y + pic.h * 0.5);
        c.root.position.set(c.x, c.y);
        c.root.zIndex = pic.y + pic.h + 0.3;
      }
    }
    for (const [id, v] of this.vanes)
      if (!seenV.has(id)) {
        v.root.destroy({ children: true });
        this.vanes.delete(id);
      }
    for (const [id, c] of this.chimes)
      if (!seenC.has(id)) {
        c.root.destroy({ children: true });
        this.chimes.delete(id);
      }
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, wind: number, calm: boolean): void {
    this.t += dt;
    const near = (x: number, y: number) => x > view.x - 30 && x < view.x + view.w + 30 && y > view.y - 30 && y < view.y + view.h + 30;
    const w = calm ? 0 : wind;
    for (const v of this.vanes.values()) {
      if (!near(v.x, v.y)) continue;
      const a = vaneAngle(this.t, w, gustAt(this.t, v.x, v.y) * w, v.phase);
      // (the arrow turns about its pole: seen side-on it's long, end-on a stub; it points left or right as it swings)
      const c = Math.cos(a);
      v.arrow.scale.x = Math.abs(c) < 0.18 ? 0.18 * Math.sign(c || 1) : c;
      v.arrow.scale.y = 1 - 0.25 * Math.abs(Math.sin(a));
    }
    const sparkle = pixelFxFrames('white-sparkle');
    const hear = view.w <= CHIME_NEAR_VIEW;
    for (const c of this.chimes.values()) {
      if (!near(c.x, c.y)) continue;
      const gust = gustAt(this.t, c.x, c.y) * Math.min(1.5, w);
      c.tubes.forEach((g, i) => (g.rotation = w * (0.08 * Math.sin(this.t * (2.2 + i * 0.4) + c.phase + i) + 0.25 * gust * Math.sin(this.t * 7 + i * 1.3))));
      if (chimeRings(w, gust, c.gust)) {
        c.glintAge = 0;
        if (hear && this.t - this.lastRing > CHIME_GAP) {
          this.lastRing = this.t;
          this.onChime?.(Math.max(-0.8, Math.min(0.8, ((c.x - view.x) / Math.max(1, view.w)) * 1.6 - 0.8)));
        }
      }
      c.gust = gust;
      // (a glint off the tubes as they swing together)
      c.glintAge += dt;
      const f = sparkle && c.glintAge < 0.6 ? pixelFxFrame('white-sparkle', Math.floor((c.glintAge / 0.6) * sparkle)) : null;
      c.glint.visible = !!f && !calm;
      if (f) c.glint.texture = f;
    }
  }

  private makeVane(id: number): Vane {
    const root = this.things.addChild(new Container());
    root.scale.set(VANE_K);
    const pole = root.addChild(new Graphics());
    pole.rect(-0.5, -POLE, 1, POLE).fill(IRON);
    // (the compass letters' little cross under the arrow)
    pole.rect(-3, -POLE + 3, 6, 1).fill(IRON);
    pole.rect(-0.5, -POLE + 1, 1, 1).fill(IRON_LIT);
    const arrow = root.addChild(new Graphics());
    arrow.position.set(0, -POLE);
    // the shaft, the head and the tail's feather (drawn pointing +x; the scale turns it)
    arrow.rect(-ARROW / 2, -0.5, ARROW, 1).fill(IRON);
    arrow.poly([ARROW / 2 + 3, 0, ARROW / 2 - 1, -2.5, ARROW / 2 - 1, 2.5]).fill(IRON);
    arrow.poly([-ARROW / 2, 0, -ARROW / 2 - 3, -3.5, -ARROW / 2 + 2, -0.5]).fill(IRON);
    arrow.poly([-ARROW / 2, 0, -ARROW / 2 - 3, 3.5, -ARROW / 2 + 2, 0.5]).fill(IRON);
    // (a little cockerel on the shaft, as old vanes have)
    arrow.rect(-2, -4, 4, 3).fill(IRON);
    arrow.rect(1, -6, 2, 2).fill(IRON);
    arrow.rect(-3, -6, 1, 3).fill(IRON);
    arrow.rect(2, -6, 1, 1).fill(IRON_LIT);
    return { root, arrow, phase: (id * 1.37) % 6.28, x: 0, y: 0 };
  }

  private makeChime(id: number): Chime {
    const root = this.things.addChild(new Container());
    root.scale.set(CHIME_K);
    const bar = root.addChild(new Graphics());
    bar.rect(-0.5, -4, 1, 4).fill(0x6a5038);
    bar.rect(-4, 0, 8, 1).fill(0x5a4030);
    const tubes: Graphics[] = [];
    const colour = BRASS[id % BRASS.length];
    [-3, -1, 1, 3].forEach((x, i) => {
      const g = root.addChild(new Graphics());
      g.position.set(x, 1);
      const len = 5 + ((i * 3 + id) % 4);
      g.rect(-0.25, 0, 0.5, 2).fill(0x3a3028);
      g.rect(-0.5, 2, 1, len).fill(colour);
      g.rect(-0.5, 2, 0.5, len).fill({ color: 0xffffff, alpha: 0.45 });
      g.alpha = 0.95;
      tubes.push(g);
    });
    const glint = root.addChild(new Sprite());
    glint.anchor.set(0.5);
    glint.scale.set(0.35);
    glint.position.set(0, 6);
    glint.visible = false;
    return { root, tubes, glint, phase: (id * 2.11) % 6.28, x: 0, y: 0, gust: 0, glintAge: 9 };
  }
}
