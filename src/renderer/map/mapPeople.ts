// Draws the townsfolk (and strangers, and the visitor at the edge of town) on the map. Positions arrive at the sim's
// tick rate and are interpolated per frame; everyone stands in `things`, sorted by their feet. The LPC sprites are
// side-on: they face the way they're going, left or right.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClassId } from '../../shared/data/classes';
import type { PersonView } from '../../shared/sim/snapshot';
import { fxTicks, poolSize, type PersonFx } from '../../shared/sim/state';
import { TICK_MS } from '../../shared/sim/time';
import { CREATURE_FRAME, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { EMOTE_SIZE, emoteFrame, levelUpFrame, HOLY_SIZE, holyFrame, REVIVE_SIZE, reviveFrame, SPELL_SIZE, spellFrame, spellFrames, SPLAT_SIZE, splatFrame, type Emote } from '../art/effects';
import { fightAnim, fightPose, heroFrame, heroScale, heroSheet, SHOOT_TICKS } from '../art/combatPoses';
import { creatureFlip } from '../art/creatures';
import { heldWeapon, wardrobe, wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, FRAME_SIZE, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { glowTexture } from '../town/layer';

const EMOTE_EVERY = 11;
const EMOTE_FOR = 3;
const PILLAR_SCALE = 2;
const HORSE_SCALE = 0.85;
const SADDLE_LIFT = 16;
const BLEED_MINUTES = 120;
const CHILD_SCALE = 0.7;
const PX_PER_WALK_FRAME = 4;
const HIT_HALF_W = 11;
const HIT_H = 50;
/** A founder is drawn this much bigger than the townsfolk, with an aura in their origin's colour. */
const FOUNDER_SCALE = 1.14;
const AURA: Record<string, number> = { town: 0xffd860, lich: 0x9a6aff, druid: 0x7ae070, vampire: 0xff3048, werewolf: 0xc8d8ff, robot: 0x60e0ff, dwarves: 0xffa040, merfolk: 0x40e0e0, nomads: 0xffc060, fae: 0xff90e0, knights: 0xf0f0ff, alchemists: 0x80ff80, settlers: 0xffd860 };

/** How long after their last blow or wound a fighting calling keeps its combat form (ticks). */
const HERO_LINGER = 50;

/** Each class's Pixel Champions hero: its sheet and block (a mage is the sage sheet's blue-robed wizard). */
const CLASS_LOOK: Partial<Record<ClassId, [CreatureSheet, number]>> = {
  necromancer: ['champ_necromancer', 0],
  summoner: ['champ_summoner', 0],
  beast_tamer: ['champ_beast_tamer', 0],
  blood_knight: ['champ_blood_knight', 0],
  mage: ['champ_sage', 4],
};

interface Drawn {
  view: PersonView;
  visitor: boolean;
  sprite: Sprite;
  shadow: Sprite;
  horse: Sprite;
  load: Graphics;
  bubble: Graphics;
  blood?: Graphics;
  bleedFrom?: number;
  /** The spray of a blow landing. */
  spray: Sprite;
  emote?: Sprite;
  levels?: number;
  levelAt?: number;
  levelUp?: Sprite;
  aura?: Sprite;
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: number;
  x: number;
  y: number;
  walked: number;
  animStart: number;
  lastActivity: string;
}

export class MapPeople {
  private readonly drawn = new Map<number, Drawn>();
  moon = false;
  theme = 'town';
  weave = false;
  founderId = -1;
  revived: { id: number; since: number; at: number } | null = null;
  fx: { id: number; kind: PersonFx; since: number; at: number }[] = [];
  private readonly sparkle = new Sprite();
  private readonly pillar = new Sprite();
  private readonly spells: Sprite[] = [];

  constructor(private readonly layer: Container) {
    this.sparkle.visible = false;
    this.sparkle.zIndex = 1e8;
    this.pillar.visible = false;
    this.pillar.zIndex = 1e8;
    this.pillar.scale.set(PILLAR_SCALE);
    layer.addChild(this.sparkle, this.pillar);
  }

  update(people: PersonView[], visitor: PersonView | null, now: number): void {
    const seen = new Set<number>();
    const all = visitor ? [...people.map((p) => [p, false] as const), [visitor, true] as const] : people.map((p) => [p, false] as const);
    for (const [p, isVisitor] of all) {
      seen.add(p.id);
      let d = this.drawn.get(p.id);
      if (!d) {
        const shadow = this.layer.addChild(new Sprite(glowTexture()));
        shadow.anchor.set(0.5);
        shadow.tint = 0x000000;
        const load = this.layer.addChild(bundle());
        const horse = this.layer.addChild(new Sprite());
        horse.scale.set(HORSE_SCALE);
        horse.visible = false;
        const sprite = this.layer.addChild(new Sprite());
        sprite.anchor.set(CENTRE_X / FRAME_SIZE, FEET_Y / FRAME_SIZE);
        const bubble = this.layer.addChild(questionBubble());
        const spray = this.layer.addChild(new Sprite());
        spray.anchor.set(0.5, 0.5);
        spray.visible = false;
        d = { view: p, visitor: isVisitor, sprite, shadow, horse, load, bubble, spray, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y }, at: now, x: p.x, y: p.y, walked: 0, animStart: now, lastActivity: p.activity };
        this.drawn.set(p.id, d);
      }
      d.from = { x: d.x, y: d.y };
      d.to = { x: p.x, y: p.y };
      d.at = now;
      const levels = Object.values(p.skills).reduce((n, k) => n + k.level, 0);
      if (d.levels !== undefined && levels > d.levels) d.levelAt = now;
      d.levels = levels;
      if (p.activity !== d.lastActivity) {
        d.animStart = now;
        d.lastActivity = p.activity;
      }
      d.view = p;
      d.visitor = isVisitor;
    }
    for (const [id, d] of this.drawn)
      if (!seen.has(id)) {
        for (const o of [d.sprite, d.shadow, d.horse, d.load, d.bubble, d.spray, d.blood, d.emote, d.levelUp, d.aura]) o?.destroy();
        this.drawn.delete(id);
      }
  }

  private dressed(v: PersonView): [PersonView['look'], string[]] {
    if (v.typeName === 'Traveller' || v.look.wear) return [v.look, wornLayers(v.gear, v.gearQ)];
    const w = wardrobe({ id: v.id, gender: v.look.gender, typeName: v.typeName, gear: v.gear, coins: v.coins, child: v.growsUpIn !== null, founder: v.id === this.founderId }, this.theme, this.weave);
    return [{ ...v.look, outfit: w.outfit }, [...w.wear, ...wornLayers(v.gear, v.gearQ)]];
  }

  private emoteFor(d: Drawn, now: number): Emote | null {
    const v = d.view;
    if (v.breakdown) return 'anger';
    if (v.activity === 'sleep') return 'zzz';
    const burst = ((now / 1000 + v.id * 3.7) % EMOTE_EVERY) < EMOTE_FOR;
    if (!burst) return null;
    if (v.needs.rest < 0.12 || v.needs.food < 0.12) return 'sweat';
    if (v.partner && v.activity !== 'fight') {
      for (const o of this.drawn.values()) if (o.view.name === v.partner && Math.hypot(o.x - d.x, o.y - d.y) < 40) return 'heart';
    }
    if (v.morale >= 85 && (v.activity === 'idle' || v.activity === 'eat')) return 'note';
    return null;
  }

  private drawSpells(now: number): void {
    while (this.spells.length < this.fx.length) {
      const sp = this.layer.addChild(new Sprite());
      sp.zIndex = 1e8;
      this.spells.push(sp);
    }
    this.spells.forEach((sp, i) => {
      const f = this.fx[i];
      const who = f && this.drawn.get(f.id);
      const n = f ? spellFrames(f.kind) : 0;
      const progress = f ? (f.since + (now - f.at) / TICK_MS) / fxTicks(f.kind) : 1;
      const frame = who && f ? spellFrame(f.kind, progress * n) : null;
      sp.visible = !!frame && !!who && !who.view.indoors;
      if (!frame || !who) return;
      sp.texture = frame;
      sp.alpha = progress > 0.8 && f.kind !== 'frost' ? (1 - progress) / 0.2 : 1;
      sp.position.set(Math.round(who.x - SPELL_SIZE / 2), Math.round(who.y - SPELL_SIZE + 14));
    });
  }

  render(now: number): void {
    const who = this.revived && this.drawn.get(this.revived.id);
    const frame = who && this.revived ? reviveFrame(Math.floor(((this.revived.since + (now - this.revived.at) / TICK_MS) * 24) / 40)) : null;
    this.sparkle.visible = !!frame;
    if (frame && who) {
      this.sparkle.texture = frame;
      this.sparkle.position.set(Math.round(who.x - REVIVE_SIZE / 2), Math.round(who.y - REVIVE_SIZE + 10));
    }
    const beam = who && this.revived ? holyFrame((this.revived.since + (now - this.revived.at) / TICK_MS) * 0.8) : null;
    this.pillar.visible = !!beam;
    if (beam && who) {
      this.pillar.texture = beam;
      this.pillar.position.set(Math.round(who.x - (HOLY_SIZE * PILLAR_SCALE) / 2), Math.round(who.y + 4 - HOLY_SIZE * PILLAR_SCALE));
    }
    this.drawSpells(now);
    for (const d of this.drawn.values()) {
      const t = Math.min(1, (now - d.at) / TICK_MS);
      const x = d.from.x + (d.to.x - d.from.x) * t;
      const y = d.from.y + (d.to.y - d.from.y) * t;
      d.walked += Math.hypot(x - d.x, y - d.y);
      d.x = x;
      d.y = y;
      const z = y;
      const hidden = d.view.indoors;
      d.sprite.visible = !hidden;
      const held = heldWeapon(d.view.gear, d.view.activity);
      let [anim, frame] = this.pose(d, now);
      if (anim === 'thrust' && held && held !== 'spear') [anim, frame] = ['slash', cycle((now - d.animStart) / 1000, 1.0, FRAME_COUNT.slash)];
      // fighting: the blow their weapon strikes (art/combatPoses.ts), a flinch when struck, lying when down
      const v = d.view;
      const fighting = v.activity === 'fight' || v.sinceBlow < SHOOT_TICKS || v.sinceHit < 3 || v.downed !== null;
      if (fighting) {
        const fp = fightPose({ sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, down: v.downed !== null }, fightAnim(v.gear, v.battle.ranged));
        if (v.activity === 'fight' || fp[0] !== 'walk') [anim, frame] = fp;
      }
      const [look, wear] = this.dressed(d.view);
      const s = d.sprite;
      s.texture = lpcFrame(look, anim, frame, held, wear);
      s.anchor.set(CENTRE_X / FRAME_SIZE, FEET_Y / FRAME_SIZE);
      const flip = d.view.dir < 0;
      const founder = d.view.founderCalling;
      const k = (d.view.growsUpIn !== null ? CHILD_SCALE : 1) * (d.view.look.height ?? 1) * (founder ? FOUNDER_SCALE : 1);
      s.scale.set(flip ? -k : k, k);
      s.position.set(Math.round(x), Math.round(y));
      s.zIndex = z;
      const glow = d.view.rally === 'on' ? (Math.sin(now / 90) > 0 ? 0xffe070 : 0xffc040) : null;
      s.tint = glow ?? (d.view.monster === 'undead' ? 0xb0c8a8 : d.view.monster === 'vampire' ? 0xe8e0f0 : 0xffffff);
      const moving = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) > 0.5;
      const facing = d.view.dir < 0 ? 'left' : 'right';
      // a fighting calling takes its combat form (a Craftpix hero) while it fights, and a little after
      const hero = heroSheet(v.cls, v.id);
      const inCombat = v.activity === 'fight' || v.sinceBlow < HERO_LINGER || v.sinceHit < HERO_LINGER;
      if (hero && inCombat && !hidden && !founder && !(v.cls && CLASS_LOOK[v.cls])) {
        s.texture = heroFrame(hero, { facing, moving, walked: d.walked, sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, sinceBlock: v.sinceBlock, down: v.downed !== null, now, ref: v.id });
        const hk = heroScale(hero) * k;
        s.anchor.set(0.5, 1);
        s.scale.set(hk * creatureFlip(hero, facing), hk);
      }
      // someone who's taken up a special class looks the part (a Pixel Champions hero, at twice size)
      if (d.view.cls && CLASS_LOOK[d.view.cls] && !hidden && !founder) {
        const [sheet, block] = CLASS_LOOK[d.view.cls]!;
        s.texture = creatureFrame(sheet, block, facing, moving ? Math.floor(d.walked / 5) : 1);
        const size = creatureSize(sheet);
        s.anchor.set(0.5, 1);
        s.scale.set(2 * k, 2 * k);
        void size;
      }
      // on a full-moon night, werewolves show what they are
      if (d.view.monster === 'werewolf' && this.moon && !hidden) {
        s.texture = creatureFrame('wolfman', 1, facing, moving ? Math.floor(d.walked / 6) : 1);
        s.anchor.set(0.5, 1);
        s.scale.set(k, k);
      }
      // cavalry: the rider sits on a horse
      const coat = d.view.mounted;
      d.horse.visible = coat !== null && !hidden;
      if (coat !== null) {
        d.horse.texture = creatureFrame('horse', coat, facing, moving ? Math.floor(d.walked / 8) % 3 : 1);
        d.horse.position.set(Math.round(x - (CREATURE_FRAME * HORSE_SCALE) / 2), Math.round(y + 2 - CREATURE_FRAME * HORSE_SCALE));
        d.horse.zIndex = z - 0.1;
        s.y -= SADDLE_LIFT;
        if (anim === 'walk') s.texture = lpcFrame(look, 'walk', 0, held, wear);
      }
      d.load.visible = !hidden && poolSize(d.view.carrying) > 0;
      d.load.position.set(Math.round(x) - d.view.dir * 7 - 4, Math.round(y) - 40);
      d.load.zIndex = z + 0.1;
      d.bubble.visible = d.visitor;
      d.bubble.position.set(Math.round(x) - 5, Math.round(y) - 66 + Math.round(Math.sin(now / 300) * 1.5));
      d.bubble.zIndex = z + 0.2;
      const arrow = d.levelAt !== undefined && !hidden ? levelUpFrame((now - d.levelAt) / 160) : null;
      if (arrow && !d.levelUp) d.levelUp = this.layer.addChild(new Sprite());
      if (d.levelUp) {
        d.levelUp.visible = !!arrow;
        if (arrow) {
          d.levelUp.texture = arrow;
          d.levelUp.position.set(Math.round(x) - 16, Math.round(y) - 60);
          d.levelUp.zIndex = z + 0.2;
        }
      }
      const emote = hidden || d.visitor || d.view.bleedMinutes !== null ? null : this.emoteFor(d, now);
      if (emote && !d.emote) d.emote = this.layer.addChild(new Sprite());
      if (d.emote) {
        d.emote.visible = !!emote;
        if (emote) {
          d.emote.texture = emoteFrame(emote, now / 140 + d.view.id)!;
          d.emote.position.set(Math.round(x) - EMOTE_SIZE / 2 + 6, Math.round(y) - 62 + Math.round(Math.sin(now / 400 + d.view.id) * 1.5));
          d.emote.zIndex = z + 0.2;
        }
      }
      // a blow landing: blood flung away from the striker
      const splat = d.view.sinceHit < 6 && !hidden ? splatFrame(d.view.sinceHit + 2) : null;
      d.spray.visible = !!splat;
      if (splat) {
        d.spray.texture = splat;
        d.spray.width = d.spray.height = SPLAT_SIZE * 0.7;
        d.spray.scale.x = -d.view.hitFrom * Math.abs(d.spray.scale.x);
        d.spray.position.set(Math.round(x - d.view.hitFrom * 6), Math.round(y - 22));
        d.spray.zIndex = z + 0.4;
      }
      const left = d.view.bleedMinutes;
      if (left === null) d.bleedFrom = undefined;
      if (left !== null && !d.blood) d.blood = this.layer.addChild(new Graphics());
      if (d.blood) {
        d.blood.visible = left !== null && !hidden;
        if (left !== null) {
          const share = Math.max(0, Math.min(1, left / Math.max(BLEED_MINUTES, (d.bleedFrom ??= left))));
          const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now / 250));
          d.blood
            .clear()
            .rect(3, 0, 2, 1).rect(2, 1, 4, 2).rect(1, 3, 6, 3).rect(2, 6, 4, 1)
            .fill({ color: 0xd42a2a, alpha: pulse })
            .rect(3, 3, 1, 2)
            .fill({ color: 0xff9a8a, alpha: pulse })
            .rect(-6, 9, 20, 3)
            .fill({ color: 0x1a120c, alpha: 0.85 })
            .rect(-5, 10, Math.max(1, Math.round(18 * share)), 1)
            .fill(0xe04040);
          d.blood.position.set(Math.round(x) - 4, Math.round(y) - 40);
          d.blood.zIndex = z + 0.2;
        }
      }
      d.shadow.visible = !hidden;
      d.shadow.width = (coat !== null ? 34 : 18) * k;
      d.shadow.height = 6 * k;
      d.shadow.alpha = 0.42;
      d.shadow.position.set(Math.round(x), Math.round(y) + 1);
      d.shadow.zIndex = z - 0.5;
      if (founder && !d.aura) {
        d.aura = this.layer.addChild(new Sprite(glowTexture()));
        d.aura.anchor.set(0.5);
      }
      if (d.aura) {
        d.aura.visible = founder && !hidden;
        d.aura.tint = AURA[this.theme] ?? AURA.town;
        d.aura.width = 52 * k;
        d.aura.height = 72 * k;
        d.aura.alpha = 0.5 + 0.15 * Math.sin(now / 700);
        d.aura.position.set(Math.round(x), Math.round(y - 22 * k));
        d.aura.zIndex = z - 0.3;
      }
    }
  }

  private pose(d: Drawn, now: number): [LpcAnim, number] {
    const secs = (now - d.animStart) / 1000;
    switch (d.view.activity) {
      case 'walk':
        return ['walk', 1 + (Math.floor(d.walked / PX_PER_WALK_FRAME) % 8)];
      case 'chop':
        return ['slash', cycle(secs, 0.9, FRAME_COUNT.slash)];
      case 'build':
        return ['slash', cycle(secs, 0.6, FRAME_COUNT.slash)];
      case 'mine':
        return ['thrust', cycle(secs, 1.0, FRAME_COUNT.thrust)];
      case 'forage':
        return ['spell', cycle(secs, 1.4, FRAME_COUNT.spell)];
      case 'research':
        return ['spell', [0, 1, 2, 3, 2, 1, 0, 0][Math.floor(secs * 2.5) % 8]];
      case 'eat':
        return ['spell', Math.floor(secs * 3) % 2];
      case 'fight':
        return ['walk', 0]; // (standing ready: the blows come from fightPose)
      case 'sleep':
        return ['hurt', FRAME_COUNT.hurt - 1];
      default:
        return ['walk', 0];
    }
  }

  /** The person (or visitor) under a world point, if any (the one standing furthest down first). */
  personAt(wx: number, wy: number): PersonView | null {
    let best: Drawn | null = null;
    for (const d of this.drawn.values()) {
      if (d.view.indoors) continue;
      if (Math.abs(wx - d.x) <= HIT_HALF_W && wy <= d.y + 2 && wy >= d.y - HIT_H && (!best || d.y > best.y)) best = d;
    }
    return best?.view ?? null;
  }

  /** Where someone is drawn now (world px, at their feet). */
  posOf(id: number): { x: number; y: number } | null {
    const d = this.drawn.get(id);
    return d ? { x: d.x, y: d.y } : null;
  }
}

function bundle(): Graphics {
  return new Graphics().rect(0, 2, 9, 9).fill(0x5a3e24).rect(1, 1, 7, 9).fill(0x8a6440).rect(1, 5, 7, 1).fill(0x5a3e24).rect(3, 0, 3, 2).fill(0x5a3e24);
}
function questionBubble(): Graphics {
  const g = new Graphics().rect(0, 0, 11, 12).fill(0x2a1f17).rect(1, 1, 9, 10).fill(0xfff4d6).rect(4, 12, 3, 2).fill(0x2a1f17);
  return g.rect(3, 2, 5, 1).fill(0x2a1f17).rect(7, 3, 1, 2).fill(0x2a1f17).rect(5, 5, 2, 1).fill(0x2a1f17).rect(5, 6, 1, 1).fill(0x2a1f17).rect(5, 8, 1, 1).fill(0x2a1f17);
}
function cycle(secs: number, period: number, frames: number): number {
  const phase = (secs % period) / period;
  return phase < 0.7 ? Math.floor((phase / 0.7) * frames) : 0;
}
