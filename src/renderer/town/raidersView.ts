// Draws raiders in town, on the walkway. Positions arrive at the sim's tick rate and are interpolated.

import { Container, Graphics, Sprite } from 'pixi.js';
import { ENEMIES } from '../../shared/data/enemies';
import type { RaiderView } from '../../shared/sim/snapshot';
import { TICK_MS } from '../../shared/sim/time';
import { creatureFeet, creatureFlip, creatureFrame, creatureSize, creatureTop, type CreatureSheet } from '../art/creatures';
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { attackAnim, enemyLook } from '../art/rivals';
import { AREA_SIZE, BLAST_SIZE, castFrame, FLAME_SIZE, fireHitFrame, lightningHitFrame, BLOOD_SIZE, bloodFrame, conjureFrame, IMPACT_SIZE, impactFrame, placeArea, portalFrame, shockFrame, SPELL_SIZE } from '../art/effects';
import type { HumanSprite, MachineSprite, StillSprite } from '../../shared/data/enemies';
import { stillTexture } from '../art/stills';
import { machineFrame, machineSize } from '../art/machines';
import { WALK_Y } from './townView';

interface Drawn {
  view: RaiderView;
  sprite: Sprite;
  bar: Graphics;
  load: Graphics;
  spark: Sprite;
  blast: Sprite;
  magic: Sprite;
  fromX: number;
  toX: number;
  at: number;
  x: number;
  walked: number;
}

export class RaidersView {
  private readonly drawn = new Map<number, Drawn>();

  constructor(private readonly layer: Container) {}

  update(raiders: RaiderView[], now: number): void {
    const seen = new Set<number>();
    for (const r of raiders) {
      if (r.gone) continue;
      seen.add(r.id);
      let d = this.drawn.get(r.id);
      if (!d) {
        const load = this.layer.addChild(bundle());
        const sprite = this.layer.addChild(new Sprite());
        const bar = this.layer.addChild(new Graphics());
        const spark = this.layer.addChild(new Sprite());
        spark.visible = false;
        const blast = this.layer.addChild(new Sprite());
        blast.visible = false;
        blast.scale.set(1.5);
        const magic = this.layer.addChild(new Sprite());
        magic.visible = false;
        d = { view: r, sprite, bar, load, spark, blast, magic, fromX: r.x, toX: r.x, at: now, x: r.x, walked: 0 };
        this.drawn.set(r.id, d);
      }
      d.fromX = d.x;
      d.toX = r.x;
      d.at = now;
      d.view = r;
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      d.sprite.destroy();
      d.bar.destroy();
      d.load.destroy();
      d.spark.destroy();
      d.blast.destroy();
      d.magic.destroy();
      this.drawn.delete(id);
    }
  }

  render(now: number): void {
    const secs = now / 1000;
    for (const d of this.drawn.values()) {
      const r = d.view;
      const t = Math.min(1, (now - d.at) / TICK_MS);
      const x = d.fromX + (d.toX - d.fromX) * t;
      d.walked += Math.abs(x - d.x);
      d.x = x;
      const moving = Math.abs(d.toX - d.fromX) > 0.5;
      const lunge = r.sinceAction < 6 && !r.down ? r.dir * 5 : 0;
      const s = d.sprite;
      const def = ENEMIES[r.kind];
      let top = WALK_Y - 50;
      if ('sheet' in def.sprite) {
        const sp = def.sprite as { sheet: CreatureSheet; block: number; scale: number };
        const frame = r.down ? 1 : moving ? Math.floor(d.walked / 6) : Math.floor(secs * 2);
        const facing = r.dir < 0 ? 'left' : 'right';
        s.texture = creatureFrame(sp.sheet, sp.block, facing, frame, r.sinceAction < 6 && !r.down);
        const size = creatureSize(sp.sheet);
        const flip = creatureFlip(sp.sheet, facing);
        s.scale.set(sp.scale * flip, sp.scale);
        s.x = Math.round(x + lunge - ((size.w * sp.scale) / 2) * flip);
        s.y = Math.round(WALK_Y + 4 - size.h * sp.scale * creatureFeet(sp.sheet));
        top = s.y + 6 + Math.round(size.h * sp.scale * creatureTop(sp.sheet));
      } else if ('still' in def.sprite) {
        // a single image: flipped to face its way, bobbing if it hovers
        const st = def.sprite as StillSprite;
        s.texture = stillTexture(st.still);
        const flip = r.dir < 0 ? -1 : 1;
        s.scale.set(st.scale * flip, st.scale);
        const w = s.texture.width * st.scale;
        const h = s.texture.height * st.scale;
        const bob = st.hover && !r.down ? Math.round(Math.sin(secs * 3 + r.id) * 2) - 6 : 0;
        s.x = Math.round(x + lunge - (w / 2) * flip);
        s.y = Math.round(WALK_Y + 2 - h + bob);
        top = s.y + 4;
      } else if ('machine' in def.sprite) {
        const ms = def.sprite as MachineSprite;
        const frame = r.down ? 0 : moving ? Math.floor(d.walked / 5) : Math.floor(secs * 6);
        s.texture = machineFrame(ms.machine, r.sinceAction < 3 && !r.down ? 3 : frame);
        const flip = r.dir < 0;
        s.scale.set((flip ? -1 : 1) * ms.scale, ms.scale);
        const size = machineSize(ms.machine);
        s.x = Math.round(x + lunge + (flip ? size / 2 : -size / 2) * ms.scale);
        s.y = Math.round(WALK_Y + 2 - size * ms.scale);
        top = s.y + 4;
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
        s.texture = lpcFrame(look, anim, frame, hs.weapon, wear);
        const flip = r.dir < 0;
        s.scale.set(flip ? -1 : 1, 1);
        s.x = Math.round(x + lunge) + (flip ? CENTRE_X + 1 : -CENTRE_X);
        s.y = WALK_Y - FEET_Y;
      }
      s.alpha = r.down ? 0.4 : 1;
      // allies (summoned, raised, tamed) glow a ghostly green
      // (a rival origin's troops wear its colours)
      s.tint = r.sinceHit < 3 && !r.down ? 0xff7070 : r.ally ? 0xa8f0b8 : (def.tint ?? 0xffffff);
      // a burst where the blow landed: blood for a Blood Knight's, crackling light for a laser's
      const since = r.sinceHit + t;
      const special = r.hitFx === 'blood' ? bloodFrame(since) : r.hitFx === 'shock' ? shockFrame(since * 1.5) : r.hitFx === 'fire' ? fireHitFrame(since * 1.2) : r.hitFx === 'lightning' ? lightningHitFrame(since * 1.2) : null;
      const spark = r.hitFx ? special : impactFrame(r.sinceHit);
      const size = r.hitFx === 'blood' ? BLOOD_SIZE : r.hitFx === 'shock' ? SPELL_SIZE : r.hitFx === 'fire' || r.hitFx === 'lightning' ? FLAME_SIZE : IMPACT_SIZE;
      d.spark.visible = !!spark;
      if (spark) {
        d.spark.texture = spark;
        d.spark.position.set(Math.round(x) - size / 2 - r.dir * 4, r.hitFx === 'shock' ? WALK_Y - size + 20 : top + 2 - (size - IMPACT_SIZE) / 2);
      }
      // a boss's sweeping attack: its own fire, quake, shell, beam or acid
      placeArea(d.blast, def.kit?.area?.fx, r.sinceArea + t, x, r.dir, WALK_Y);
      // a Summoner's spirit steps out of a rift; dark magic swirls round the raised and the tamed
      // (and a cold vortex swirls round an ice mage as they cast)
      const portal = r.kind === 'spirit';
      // (and a rival lord as it casts one of its spells)
      const casting = ((r.kind === 'ice_mage' || r.kind === 'frost_archmage') && !r.down) || (r.sinceCast < 20 && !r.down);
      const magic = portal ? portalFrame((r.sinceConjured + t) * 1.5) : casting ? castFrame((Math.min(r.sinceAction, r.sinceCast) + t) * 1.4) : conjureFrame(Math.floor(r.sinceConjured * 2 + t * 2));
      const msize = portal || casting ? AREA_SIZE : BLAST_SIZE;
      d.magic.visible = !!magic;
      if (magic) {
        d.magic.texture = magic;
        d.magic.position.set(Math.round(x + (casting ? r.dir * 12 : 0)) - msize / 2, WALK_Y - msize + (portal ? 16 : casting ? 2 : 6));
      }
      d.load.visible = (r.carrying > 0 || !!r.captive) && !r.down;
      d.load.position.set(Math.round(x) - r.dir * 8 - 4, top + 10);
      const w = 20;
      d.bar.clear();
      if (!r.down) {
        d.bar
          .rect(x - w / 2 - 1, top - 5, w + 2, 4)
          .fill({ color: 0x1a120c, alpha: 0.85 })
          .rect(x - w / 2, top - 4, Math.max(1, Math.round((w * r.hp) / r.maxHp)), 2)
          .fill(r.ally ? 0x8cc05a : 0xe06040);
      }
    }
  }

  /** The raider under a local (fore-layer) point, if any. */
  raiderAt(localX: number, localY: number): RaiderView | null {
    for (const d of this.drawn.values()) {
      if (d.view.down) continue;
      if (Math.abs(localX - d.x) <= 16 && localY <= WALK_Y + 4 && localY >= WALK_Y - 50) return d.view;
    }
    return null;
  }
}

function bundle(): Graphics {
  return new Graphics().rect(0, 2, 9, 9).fill(0x5a3e24).rect(1, 1, 7, 9).fill(0x8a6440).rect(1, 5, 7, 1).fill(0x5a3e24).rect(3, 0, 3, 2).fill(0x5a3e24);
}
