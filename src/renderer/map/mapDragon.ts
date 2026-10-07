// The dragon in the sky (sim/dragon.ts): on an omen flight only its vast shadow sweeps over the land (it is too high
// to see); on a pass it comes in low over the roofs, wings beating, its shadow racing below, breathing a stream of fire
// over the middle of its run. Drawn from its enemy's sheet (the wyvern), tinted by which dragon it is. Renderer only.

import { Container, Sprite } from 'pixi.js';
import { ENEMIES } from '../../shared/data/enemies';
import type { DragonView } from '../../shared/sim/dragon';
import { creatureFlip, creatureFrame } from '../art/creatures';
import type { CreatureSheet } from '../art/creatures';
import { glowTexture } from '../town/layer';
import type { MapView } from './mapView';

const TINT: Record<string, number> = { rimewyrm: 0xa8e0ff, ashen_wyrm: 0xb8b4b0, dragon: 0xffffff };
/** How big it's drawn low over the town, and its shadow from high up. */
const LOW_SCALE = 3.4;
const HIGH_SHADOW = 5;
/** How high over its shadow it flies on a pass (px). */
const ALTITUDE = 90;
const SECONDS_PER_TICK = 0.1;

interface Ember {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class MapDragon {
  /** Called when a flight begins: low (a pass) or high (an omen), and where across the view (-1 to 1). */
  onFlight: ((low: boolean, pan: number) => void) | null = null;
  private readonly body = new Sprite();
  private readonly shadow = new Sprite();
  private readonly embers: Ember[] = [];
  private view: DragonView | null = null;
  private t = 0;
  private ticks = 140;
  private flying = false;
  private frame = 0;
  private lastKey = '';

  constructor(
    private readonly over: Container,
    under: Container,
    private readonly map: MapView,
  ) {
    this.body.anchor.set(0.5, 0.6);
    this.shadow.anchor.set(0.5, 0.6);
    this.shadow.tint = 0x000000;
    this.body.visible = this.shadow.visible = false;
    over.addChild(this.body);
    under.addChild(this.shadow);
  }

  sync(v: DragonView | null): void {
    this.view = v;
    const f = v?.flight;
    if (!f) {
      this.flying = false;
      return;
    }
    const key = `${f.from.x},${f.from.y},${f.low}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.t = f.t;
      this.ticks = f.low ? 140 : 196;
      const mv = this.map.view;
      this.onFlight?.(f.low, Math.max(-1, Math.min(1, ((f.from.x + f.to.x) / 2 - mv.x) / Math.max(1, mv.w) * 2 - 1)));
    } else if (Math.abs(f.t - this.t) > 0.08) this.t = f.t;
    this.flying = true;
  }

  render(dt: number): void {
    const v = this.view;
    const f = v?.flight;
    const on = this.flying && !!f && !!v && this.t < 1;
    this.body.visible = this.shadow.visible = on;
    if (on) {
      this.t += dt / (this.ticks * SECONDS_PER_TICK);
      const x = f.from.x + (f.to.x - f.from.x) * this.t;
      const y = f.from.y + (f.to.y - f.from.y) * this.t;
      const def = ENEMIES[v.kind] ?? ENEMIES.dragon;
      const sp = def.sprite as { sheet: CreatureSheet; block: number };
      const facing = f.to.x >= f.from.x ? 'right' : 'left';
      this.frame += dt * 7;
      // (a strip sheet faces one way: turned to the way it flies)
      const flip = creatureFlip(sp.sheet, facing);
      const tex = creatureFrame(sp.sheet, sp.block, facing, Math.floor(this.frame), f.low && this.breathing());
      // (it comes in out of the distance and goes off into it: faded at the ends of its run)
      const fade = Math.min(1, this.t * 6, (1 - this.t) * 6);
      this.shadow.texture = tex;
      if (f.low) {
        this.body.texture = tex;
        this.body.tint = TINT[v.kind] ?? 0xffffff;
        this.body.scale.set(LOW_SCALE * flip, LOW_SCALE);
        this.body.alpha = fade;
        // (wings beating: it rises and dips a little)
        this.body.position.set(x, y - ALTITUDE + Math.sin(this.frame * 1.3) * 5);
        this.shadow.scale.set(LOW_SCALE * 0.9 * flip, LOW_SCALE * 0.45);
        this.shadow.alpha = 0.3 * fade;
        this.shadow.position.set(x + 20, y + 10);
        if (this.breathing() && !this.map.calm) this.breathe(x + (facing === 'right' ? 1 : -1) * 95, y - ALTITUDE + 4, facing === 'right' ? 1 : -1, y);
      } else {
        this.body.visible = false;
        this.shadow.scale.set(HIGH_SHADOW, HIGH_SHADOW * 0.5);
        this.shadow.alpha = 0.22 * fade;
        this.shadow.position.set(x, y);
      }
    }
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life -= dt;
      if (e.life <= 0) {
        e.s.destroy();
        this.embers.splice(i, 1);
        continue;
      }
      e.s.x += e.vx * dt;
      e.s.y += e.vy * dt;
      const k = e.life / e.max;
      e.s.alpha = Math.min(1, k * 1.5);
      e.s.scale.set(0.45 + (1 - k) * 1.1);
      e.s.tint = k > 0.6 ? 0xffe070 : k > 0.3 ? 0xff8a30 : 0x803020;
    }
  }

  /** It breathes fire over the middle of a pass. */
  private breathing(): boolean {
    return this.t > 0.32 && this.t < 0.68;
  }

  private breathe(mx: number, my: number, dir: number, ground: number): void {
    for (let k = 0; k < 6 && this.embers.length < 220; k++) {
      const s = this.over.addChild(new Sprite(glowTexture()));
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.position.set(mx, my);
      const max = 0.5 + Math.random() * 0.4;
      // (the stream pours down and ahead, onto the roofs below)
      this.embers.push({ s, vx: dir * (60 + Math.random() * 80), vy: (ground - my) / max + (Math.random() - 0.5) * 40, life: max, max });
    }
  }
}
