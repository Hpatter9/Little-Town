// The town's great creature on the map (sim/creature.ts): drawn like a raider from a creature sheet (its kind's stand-in
// in data/creature.ts `look`, until its own art comes to art/iso/creature/<kind>/), bigger as it grows (`scale`), and
// tinted by its nature (`tint`: warm and bright when good, dark and red when cruel). It walks smoothly between the
// sim's ticks, lies still while it sleeps, and shows a small "?" over its head while a deed waits on praise or a
// scolding. Drawn into the things in world px (the iso view moves it onto the diamonds). Renderer only.

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { CREATURE_DEFS } from '../../shared/data/creature';
import type { CreatureView } from '../../shared/sim/creature';
import { creatureFeet, creatureFlip, creatureFrame, creaturePoseFrames, creatureSize, type CreatureSheet } from '../art/creatures';

/** How fast the drawn creature catches up with where the sim has it (a share of the gap a second). */
const EASE = 6;

export class MapCreature {
  private readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly body = new Sprite();
  private readonly mark = new Text({ text: '?', style: { fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: 0xffe08a, stroke: { color: 0x2a1a08, width: 3 } } });
  private view: CreatureView | null = null;
  private x = 0;
  private y = 0;
  private walked = 0;
  private t = 0;
  private placed = false;

  constructor(into: Container) {
    this.shadow.ellipse(0, 0, 12, 4).fill({ color: 0x000000, alpha: 0.3 });
    this.mark.anchor.set(0.5, 1);
    this.root.addChild(this.shadow, this.body, this.mark);
    this.root.visible = false;
    into.addChild(this.root);
  }

  sync(v: CreatureView | null): void {
    this.view = v && !v.dead ? v : null;
    if (this.view && !this.placed) {
      this.x = this.view.x;
      this.y = this.view.y;
      this.placed = true;
    }
    if (!this.view) this.placed = false;
  }

  render(dt: number): void {
    const v = this.view;
    this.root.visible = !!v;
    if (!v) return;
    this.t += dt;
    const k = Math.min(1, dt * EASE);
    const nx = this.x + (v.x - this.x) * k;
    const ny = this.y + (v.y - this.y) * k;
    const step = Math.hypot(nx - this.x, ny - this.y);
    this.walked += step;
    this.x = nx;
    this.y = ny;
    const look = CREATURE_DEFS[v.kind].look;
    const sheet = look.sheet as CreatureSheet;
    const facing = v.dir < 0 ? 'left' : 'right';
    const moving = step > 0.05 && !v.asleep;
    const idle = creaturePoseFrames(sheet, 'idle') > 0 && !moving;
    const frame = moving ? Math.floor(this.walked / 7) : v.asleep ? 0 : Math.floor(this.t * 2);
    this.body.texture = creatureFrame(sheet, look.block, facing, frame, false, idle ? 'idle' : undefined);
    const scale = look.scale * v.scale;
    this.body.anchor.set(0.5, creatureFeet(sheet));
    this.body.scale.set(scale * creatureFlip(sheet, facing), scale * (v.asleep ? 0.85 : 1));
    this.body.tint = v.tint;
    this.shadow.scale.set(v.scale);
    this.mark.visible = !!v.ask;
    this.mark.position.set(0, -creatureSize(sheet).h * scale * 0.8 - 4 + Math.sin(this.t * 4) * 2);
    // (in world px: the iso view's `placeLoose` moves it onto the diamonds and sorts it among the buildings)
    this.root.position.set(Math.round(this.x), Math.round(this.y + 4));
    this.root.zIndex = Math.round(this.y);
  }

  /** Where it stands (world px), or null. */
  posOf(): { x: number; y: number } | null {
    return this.view ? { x: this.x, y: this.y } : null;
  }

  /** Whether a world point is on it (generous: it's big, and fingers are blunt). */
  at(wx: number, wy: number): boolean {
    const v = this.view;
    if (!v) return false;
    const r = 18 * v.scale;
    return Math.abs(wx - this.x) < r && wy > this.y - r * 1.4 && wy < this.y + r * 0.8;
  }
}
