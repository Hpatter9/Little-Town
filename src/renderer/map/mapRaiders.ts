// Draws raiders on the map, interpolated between the sim's ticks, with a health bar and a flash where blows land
// (the raid map's own fighting is phase 5: for now they come in along the camp's row).

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { WAIST } from '../art/merTail';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import type { RaiderView } from '../../shared/sim/snapshot';
import { TICK_MS } from '../../shared/sim/time';
import { creatureFeet, creatureFlip, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { BLOOD_SIZE, bloodFrame, FLAME_SIZE, fireHitFrame, IMPACT_SIZE, impactFrame, lightningHitFrame, shockFrame, SPELL_SIZE, SPLAT_SIZE, splatFrame } from '../art/effects';
import { bleeds } from './bloodPools';
import { CENTRE_X, FEET_Y, FRAME_COUNT, FRAME_SIZE, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { machineFrame, machineSize } from '../art/machines';
import { attackAnim, enemyLook } from '../art/rivals';
import { stillTexture } from '../art/stills';
import { glowTexture } from '../town/layer';

interface Drawn {
  view: RaiderView;
  sprite: Sprite;
  shadow: Sprite;
  bar: Graphics;
  load: Graphics;
  spark: Sprite;
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: number;
  x: number;
  y: number;
  walked: number;
  /** Walking up or down the map (from the way they last moved), else side-on. */
  face?: 'up' | 'down' | null;
}

export class MapRaiders {
  private readonly drawn = new Map<number, Drawn>();

  constructor(private readonly layer: Container) {}

  update(raiders: RaiderView[], now: number): void {
    const seen = new Set<number>();
    for (const r of raiders) {
      if (r.gone) continue;
      seen.add(r.id);
      let d = this.drawn.get(r.id);
      if (!d) {
        const shadow = this.layer.addChild(new Sprite(glowTexture()));
        shadow.anchor.set(0.5);
        shadow.tint = 0x000000;
        const load = this.layer.addChild(bundle());
        const sprite = this.layer.addChild(new Sprite());
        const bar = this.layer.addChild(new Graphics());
        const spark = this.layer.addChild(new Sprite());
        spark.visible = false;
        d = { view: r, sprite, shadow, bar, load, spark, from: { x: r.x, y: r.y }, to: { x: r.x, y: r.y }, at: now, x: r.x, y: r.y, walked: 0 };
        this.drawn.set(r.id, d);
      }
      d.from = { x: d.x, y: d.y };
      d.to = { x: r.x, y: r.y };
      d.at = now;
      d.view = r;
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      for (const o of [d.sprite, d.shadow, d.bar, d.load, d.spark]) o.destroy();
      this.drawn.delete(id);
    }
  }

  render(now: number): void {
    const secs = now / 1000;
    for (const d of this.drawn.values()) {
      const r = d.view;
      const t = Math.min(1, (now - d.at) / TICK_MS);
      const x = d.from.x + (d.to.x - d.from.x) * t;
      const y = d.from.y + (d.to.y - d.from.y) * t;
      d.walked += Math.hypot(x - d.x, y - d.y);
      d.x = x;
      d.y = y;
      const moving = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) > 0.5;
      const lunge = r.sinceAction < 6 && !r.down ? r.dir * 5 : 0;
      const s = d.sprite;
      const def = ENEMIES[r.kind];
      const facing = r.dir < 0 ? 'left' : 'right';
      let top = y - 50;
      if ('sheet' in def.sprite) {
        const sp = def.sprite as { sheet: CreatureSheet; block: number; scale: number };
        const frame = r.down ? 1 : moving ? Math.floor(d.walked / 6) : Math.floor(secs * 2);
        s.texture = creatureFrame(sp.sheet, sp.block, facing, frame, r.sinceAction < 6 && !r.down, r.down ? 'dead' : !moving && r.sinceAction >= 6 ? 'idle' : undefined);
        const size = creatureSize(sp.sheet);
        const flip = creatureFlip(sp.sheet, facing);
        s.anchor.set(0.5, creatureFeet(sp.sheet));
        s.scale.set(sp.scale * flip, sp.scale);
        s.position.set(Math.round(x + lunge), Math.round(y + 4));
        top = y + 4 - size.h * sp.scale;
      } else if ('still' in def.sprite) {
        const st = def.sprite as StillSprite;
        s.texture = stillTexture(st.still);
        const flip = r.dir < 0 ? -1 : 1;
        s.anchor.set(0.5, 1);
        s.scale.set(st.scale * flip, st.scale);
        const bob = st.hover && !r.down ? Math.round(Math.sin(secs * 3 + r.id) * 2) - 6 : 0;
        s.position.set(Math.round(x + lunge), Math.round(y + 2 + bob));
        top = y + 2 + bob - s.texture.height * st.scale;
      } else if ('machine' in def.sprite) {
        const ms = def.sprite as MachineSprite;
        const frame = r.down ? 0 : moving ? Math.floor(d.walked / 5) : Math.floor(secs * 6);
        s.texture = machineFrame(ms.machine, r.sinceAction < 3 && !r.down ? 3 : frame);
        const flip = r.dir < 0;
        s.anchor.set(0.5, 1);
        s.scale.set((flip ? -1 : 1) * ms.scale, ms.scale);
        s.position.set(Math.round(x + lunge), Math.round(y + 2));
        top = y + 2 - machineSize(ms.machine) * ms.scale;
      } else {
        const hs = def.sprite as HumanSprite;
        const { look, wear } = enemyLook(hs.people, r.id);
        let anim: LpcAnim = 'walk';
        let frame = moving ? 1 + (Math.floor(d.walked / 4) % 8) : 0;
        if (r.down) {
          anim = 'hurt';
          frame = FRAME_COUNT.hurt - 1;
        } else if (r.sinceAction < 8) {
          anim = attackAnim(hs, def.ranged);
          frame = Math.min(FRAME_COUNT[anim] - 1, Math.floor(r.sinceAction * (anim === 'shoot' ? 1.6 : 1)));
        }
        // up or down the map when that's mostly how they're moving (the trail runs every way)
        const mdx = d.to.x - d.from.x;
        const mdy = d.to.y - d.from.y;
        if (moving) d.face = Math.abs(mdy) > Math.abs(mdx) * 1.2 ? (mdy < 0 ? 'up' : 'down') : null;
        const faceWay = anim === 'walk' && d.face ? d.face : undefined;
        s.texture = lpcFrame(look, anim, frame, hs.weapon, wear, faceWay);
        s.anchor.set(CENTRE_X / FRAME_SIZE, FEET_Y / FRAME_SIZE);
        s.scale.set(r.dir < 0 && !faceWay ? -1 : 1, 1);
        s.position.set(Math.round(x + lunge), Math.round(y));
        top = y - 50;
      }
      // in the water (a raid from the sea coming ashore): only the top of them shows, bobbing on the swell
      if (r.swimming && !r.down) {
        s.texture = waistCrop(s.texture);
        s.anchor.set(s.anchor.x, 1);
        const bob = Math.sin(secs * 2.6 + r.id) * 1.5;
        s.position.set(Math.round(x + lunge), Math.round(y - 4 + bob));
      }
      s.zIndex = y;
      s.alpha = r.down ? 0.4 : 1;
      // (an ally keeps its own colours: a green glow underfoot and a green bar mark it as the town's; tinting the
      // whole creature green made a summoned wolf look like a stray monster)
      s.tint = r.sinceHit < 3 && !r.down ? 0xff7070 : (def.tint ?? 0xffffff);
      const since = r.sinceHit + t;
      const special = r.hitFx === 'blood' ? bloodFrame(since) : r.hitFx === 'shock' ? shockFrame(since * 1.5) : r.hitFx === 'fire' ? fireHitFrame(since * 1.2) : r.hitFx === 'lightning' ? lightningHitFrame(since * 1.2) : null;
      // (a plain blow: flesh sprays blood, the rest a spark)
      const bloody = !r.hitFx && bleeds(r.kind);
      const spark = r.hitFx ? special : bloody ? splatFrame(r.sinceHit + 2) : impactFrame(r.sinceHit);
      const size = r.hitFx === 'blood' ? BLOOD_SIZE : r.hitFx === 'shock' ? SPELL_SIZE : r.hitFx === 'fire' || r.hitFx === 'lightning' ? FLAME_SIZE : bloody ? SPLAT_SIZE * 0.75 : IMPACT_SIZE;
      d.spark.visible = !!spark;
      d.spark.scale.x = bloody ? -r.dir : 1; // (the spray flies back, away from whoever struck)
      if (spark) {
        d.spark.texture = spark;
        d.spark.width = size;
        d.spark.height = size;
        d.spark.position.set(Math.round(x) - (bloody ? -r.dir : 1) * (size / 2) - r.dir * 4 - (bloody && r.dir > 0 ? 0 : 0), Math.round(r.hitFx === 'shock' ? y - size + 20 : top + 2 - (size - IMPACT_SIZE) / 2));
        d.spark.zIndex = y + 0.3;
      }
      d.load.visible = (r.carrying > 0 || !!r.captive) && !r.down;
      d.load.position.set(Math.round(x) - r.dir * 8 - 4, Math.round(top) + 10);
      d.load.zIndex = y + 0.1;
      // (the bar stands over the raider and draws about itself: the map culls each thing by where it stands)
      const w = 20;
      d.bar.clear();
      d.bar.position.set(Math.round(x), Math.round(top));
      if (!r.down) {
        d.bar
          .rect(-w / 2 - 1, -5, w + 2, 4)
          .fill({ color: 0x1a120c, alpha: 0.85 })
          .rect(-w / 2, -4, Math.max(1, Math.round((w * r.hp) / r.maxHp)), 2)
          .fill(r.ally ? 0x8cc05a : 0xe06040);
      }
      d.bar.zIndex = y + 0.4;
      d.shadow.visible = s.visible;
      d.shadow.width = Math.max(10, Math.abs(s.width) * 0.6);
      d.shadow.height = Math.max(4, Math.abs(s.width) * 0.12);
      d.shadow.alpha = r.down ? 0.25 : r.ally ? 0.7 : 0.42;
      d.shadow.tint = r.ally && !r.down ? 0x60e070 : 0x000000;
      d.shadow.position.set(Math.round(x), Math.round(y) + 2);
      d.shadow.zIndex = y - 0.5;
    }
  }

  raiderAt(wx: number, wy: number): RaiderView | null {
    for (const d of this.drawn.values()) {
      if (d.view.down) continue;
      if (Math.abs(wx - d.x) <= 16 && wy <= d.y + 4 && wy >= d.y - 50) return d.view;
    }
    return null;
  }

  posOf(id: number): { x: number; y: number } | null {
    const d = this.drawn.get(id);
    return d ? { x: d.x, y: d.y } : null;
  }
}

function bundle(): Graphics {
  return new Graphics().rect(0, 2, 9, 9).fill(0x5a3e24).rect(1, 1, 7, 9).fill(0x8a6440).rect(1, 5, 7, 1).fill(0x5a3e24).rect(3, 0, 3, 2).fill(0x5a3e24);
}

/** The top of a frame (to the waist), for someone in the water; cached per frame. */
const crops = new WeakMap<Texture, Texture>();
function waistCrop(tex: Texture): Texture {
  let t = crops.get(tex);
  if (!t) {
    const f = tex.frame;
    t = new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.width, Math.max(1, Math.round(f.height * WAIST))) });
    crops.set(tex, t);
  }
  return t;
}
