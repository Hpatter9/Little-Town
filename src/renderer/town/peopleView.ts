// Draws people on the walkway. Positions arrive at the sim's tick rate and are interpolated per frame.

import { ROOM_H, PLINTH } from '../art/castle';
import { Container, Graphics, Sprite } from 'pixi.js';
import type { PersonView } from '../../shared/sim/snapshot';
import { poolSize } from '../../shared/sim/state';
import { TICK_MS } from '../../shared/sim/time';
import { heldWeapon, wornLayers } from '../art/held';
import { CREATURE_FRAME, creatureFrame, creatureSize } from '../art/creatures';
import { EMOTE_SIZE, emoteFrame, levelUpFrame, HOLY_SIZE, holyFrame, REVIVE_SIZE, reviveFrame, SPELL_SIZE, spellFrame, spellFrames, type Emote } from '../art/effects';

/** Emotes in bursts: shown for EMOTE_FOR seconds out of every EMOTE_EVERY. */
const EMOTE_EVERY = 11;
const EMOTE_FOR = 3;

/** The revival's pillar of light (48px art) is drawn this much bigger. */
const PILLAR_SCALE = 2;
import { fxTicks, type PersonFx } from '../../shared/sim/state';

/** Horses under riders (cavalry) are drawn at this size, and lift the rider this far. */
const HORSE_SCALE = 0.85;
const SADDLE_LIFT = 16;

/** How long the downed have (game minutes, the sim's BLEED_TICKS): the bleeding bar's full length. */
const BLEED_MINUTES = 120;

/** Children are drawn at this size. */
const CHILD_SCALE = 0.7;
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { WALK_Y } from './townView';

/** Walk frames advance once per this many pixels travelled, so feet don't slide. */
const PX_PER_WALK_FRAME = 4;
/** Hit box around a person's feet (local px). */
const HIT_HALF_W = 11;
const HIT_H = 50;

interface Drawn {
  view: PersonView;
  visitor: boolean;
  sprite: Sprite;
  horse: Sprite;
  load: Graphics;
  bubble: Graphics;
  /** Over someone bleeding out (made when first needed), and the time they had when first seen bleeding (an
   *  infirmary gives them longer). */
  blood?: Graphics;
  bleedFrom?: number;
  /** An emote over their head (made when first needed). */
  emote?: Sprite;
  /** Their skill levels added up (to spot a level-up), when the last one came, and its arrow. */
  levels?: number;
  levelAt?: number;
  levelUp?: Sprite;
  /** How far up they're drawn (in a castle's room), and when it was last eased. */
  lift?: number;
  liftAt?: number;
  fromX: number;
  toX: number;
  at: number;
  x: number;
  walked: number;
  animStart: number;
  lastActivity: string;
}

/** From the walkway up to a castle room's floor (the ground floor's boards, over the keep's plinth, on the middle
 *  ground behind the walkway), and how fast people climb (px a second). */
const FLOOR_LIFT = WALK_Y + 2 + PLINTH + 3;
const CLIMB_SPEED = 90;

export class PeopleView {
  private readonly drawn = new Map<number, Drawn>();
  /** A full-moon night (werewolves change). */
  moon = false;
  /** Someone just brought back from death (they glow). */
  revived: { id: number; since: number; at: number } | null = null;
  /** Spells cast on townsfolk lately (turned, healed): ticks since, as of `at`. */
  fx: { id: number; kind: PersonFx; since: number; at: number }[] = [];
  private readonly sparkle = new Sprite();
  private readonly pillar = new Sprite();
  private readonly spells: Sprite[] = [];

  constructor(private readonly layer: Container) {
    this.sparkle.visible = false;
  }

  /** New sim positions: interpolate toward them over one tick. The visitor (if any) gets a "?" over their head. */
  update(people: PersonView[], visitor: PersonView | null, now: number): void {
    const seen = new Set<number>();
    const all = visitor ? [...people.map((p) => [p, false] as const), [visitor, true] as const] : people.map((p) => [p, false] as const);
    for (const [p, isVisitor] of all) {
      seen.add(p.id);
      let d = this.drawn.get(p.id);
      if (!d) {
        const load = this.layer.addChild(bundle());
        const horse = this.layer.addChild(new Sprite());
        horse.scale.set(HORSE_SCALE);
        horse.visible = false;
        const sprite = this.layer.addChild(new Sprite());
        const bubble = this.layer.addChild(questionBubble());
        d = { view: p, visitor: isVisitor, sprite, horse, load, bubble, fromX: p.x, toX: p.x, at: now, x: p.x, walked: 0, animStart: now, lastActivity: p.activity };
        this.drawn.set(p.id, d);
      }
      d.fromX = d.x;
      d.toX = p.x;
      d.at = now;
      // a skill went up since the last snapshot: a golden arrow over them (not on first sight)
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
    for (const [id, d] of this.drawn) {
      if (!seen.has(id)) {
        d.sprite.destroy();
        d.horse.destroy();
        d.load.destroy();
        d.bubble.destroy();
        d.blood?.destroy();
        d.emote?.destroy();
        d.levelUp?.destroy();
        this.drawn.delete(id);
      }
    }
  }

  /** Which emote to show over someone right now, if any: anger in a breakdown and zzz asleep in the open always;
   *  sweat (worn out or starving), a heart (with their partner) and notes (in high spirits) in short bursts, each
   *  person on their own beat so the strip isn't a wall of icons. */
  private emoteFor(d: Drawn, now: number): Emote | null {
    const v = d.view;
    if (v.breakdown) return 'anger';
    if (v.activity === 'sleep') return 'zzz';
    const burst = ((now / 1000 + v.id * 3.7) % EMOTE_EVERY) < EMOTE_FOR;
    if (!burst) return null;
    if (v.needs.rest < 0.12 || v.needs.food < 0.12) return 'sweat';
    if (v.partner && v.activity !== 'fight') {
      for (const o of this.drawn.values()) if (o.view.name === v.partner && Math.abs(o.x - d.x) < 40) return 'heart';
    }
    if (v.morale >= 85 && (v.activity === 'idle' || v.activity === 'eat')) return 'note';
    return null;
  }

  /** Dark magic round the newly turned (spores for the undead, a ring of blood for a vampire, moonlight for a
   *  werewolf), and a healing glow when a medkit is used. Each plays once over about four seconds. */
  private drawSpells(now: number): void {
    while (this.spells.length < this.fx.length) this.spells.push(this.layer.addChild(new Sprite()));
    this.spells.forEach((sp, i) => {
      const f = this.fx[i];
      const who = f && this.drawn.get(f.id);
      const n = f ? spellFrames(f.kind) : 0;
      const progress = f ? (f.since + (now - f.at) / TICK_MS) / fxTicks(f.kind) : 1;
      const frame = who && f ? spellFrame(f.kind, progress * n) : null;
      sp.visible = !!frame && !!who && !who.view.indoors;
      if (!frame || !who) return;
      sp.texture = frame;
      sp.alpha = progress > 0.8 && f.kind !== 'frost' ? (1 - progress) / 0.2 : 1; // (the spores never fade on their own)
      sp.position.set(Math.round(who.x - SPELL_SIZE / 2), WALK_Y - SPELL_SIZE + 14);
      this.layer.setChildIndex(sp, this.layer.children.length - 1);
    });
  }

  /** Advance interpolation and animation frames. */
  render(now: number): void {
    // golden sparkles round whoever was just revived (over everyone else)
    if (this.sparkle.parent !== this.layer) this.layer.addChild(this.sparkle);
    const who = this.revived && this.drawn.get(this.revived.id);
    const frame = who && this.revived ? reviveFrame(Math.floor(((this.revived.since + (now - this.revived.at) / TICK_MS) * 24) / 40)) : null;
    this.sparkle.visible = !!frame;
    if (frame && who) {
      this.sparkle.texture = frame;
      this.sparkle.position.set(Math.round(who.x - REVIVE_SIZE / 2), WALK_Y - REVIVE_SIZE + 10);
      this.layer.setChildIndex(this.sparkle, this.layer.children.length - 1);
    }
    // and a pillar of holy light comes down on them first
    if (this.pillar.parent !== this.layer) {
      this.layer.addChild(this.pillar);
      this.pillar.scale.set(PILLAR_SCALE);
    }
    const beam = who && this.revived ? holyFrame((this.revived.since + (now - this.revived.at) / TICK_MS) * 0.8) : null;
    this.pillar.visible = !!beam;
    if (beam && who) {
      this.pillar.texture = beam;
      this.pillar.position.set(Math.round(who.x - (HOLY_SIZE * PILLAR_SCALE) / 2), WALK_Y + 4 - HOLY_SIZE * PILLAR_SCALE);
      this.layer.setChildIndex(this.pillar, this.layer.children.length - 1);
    }
    this.drawSpells(now);
    for (const d of this.drawn.values()) {
      const t = Math.min(1, (now - d.at) / TICK_MS);
      const x = d.fromX + (d.toX - d.fromX) * t;
      d.walked += Math.abs(x - d.x);
      d.x = x;

      const hidden = d.view.indoors; // asleep inside a building
      d.sprite.visible = !hidden;
      const held = heldWeapon(d.view.gear, d.view.activity);
      let [anim, frame] = this.pose(d, now);
      // clubs, axes and knives are swung, not thrust (the LPC layers only have swinging frames for them)
      if (anim === 'thrust' && held === 'bow') [anim, frame] = ['shoot', cycle((now - d.animStart) / 1000, 1.2, FRAME_COUNT.shoot)];
      else if (anim === 'thrust' && held && held !== 'spear') [anim, frame] = ['slash', cycle((now - d.animStart) / 1000, 1.0, FRAME_COUNT.slash)];
      d.sprite.texture = lpcFrame(d.view.look, anim, frame, held, wornLayers(d.view.gear));
      const flip = d.view.dir < 0;
      const k = d.view.growsUpIn !== null ? CHILD_SCALE : 1; // children are drawn smaller
      d.sprite.scale.set(flip ? -k : k, k);
      d.sprite.x = Math.round(x) + (flip ? (CENTRE_X + 1) * k : -CENTRE_X * k);
      d.sprite.y = WALK_Y - FEET_Y * k;
      // the turned look it: the undead grey-green, vampires deathly pale
      d.sprite.tint = d.view.monster === 'undead' ? 0xb0c8a8 : d.view.monster === 'vampire' ? 0xe8e0f0 : 0xffffff;
      // someone who's taken up a special class looks the part (a Pixel Champions hero, at twice size)
      if (d.view.cls && !hidden) {
        const facing = d.view.dir < 0 ? 'left' : 'right';
        const moving = Math.abs(d.toX - d.fromX) > 0.5;
        const sheet = `champ_${d.view.cls}` as const;
        d.sprite.texture = creatureFrame(sheet, 0, facing, moving ? Math.floor(d.walked / 5) : 1);
        const size = creatureSize(sheet);
        d.sprite.scale.set(2 * k, 2 * k);
        d.sprite.x = Math.round(x - size.w * k);
        d.sprite.y = Math.round(WALK_Y + 1 - size.h * 2 * k);
      }
      // on a full-moon night, werewolves show what they are
      if (d.view.monster === 'werewolf' && this.moon && !hidden) {
        const facing = d.view.dir < 0 ? 'left' : 'right';
        const moving = Math.abs(d.toX - d.fromX) > 0.5;
        d.sprite.texture = creatureFrame('wolfman', 1, facing, moving ? Math.floor(d.walked / 6) : 1);
        const size = creatureSize('wolfman');
        d.sprite.scale.set(k, k);
        d.sprite.x = Math.round(x - (size.w * k) / 2);
        d.sprite.y = Math.round(WALK_Y + 2 - size.h * k);
      }
      // cavalry: the rider sits on a horse (it trots while they move)
      const coat = d.view.mounted;
      d.horse.visible = coat !== null && !hidden;
      if (coat !== null) {
        const moving = Math.abs(d.toX - d.fromX) > 0.5;
        d.horse.texture = creatureFrame('horse', coat, d.view.dir < 0 ? 'left' : 'right', moving ? Math.floor(d.walked / 8) % 3 : 1);
        d.horse.x = Math.round(x - (CREATURE_FRAME * HORSE_SCALE) / 2);
        d.horse.y = Math.round(WALK_Y + 2 - CREATURE_FRAME * HORSE_SCALE);
        d.sprite.y -= SADDLE_LIFT;
        if (anim === 'walk') d.sprite.texture = lpcFrame(d.view.look, 'walk', 0, held, wornLayers(d.view.gear)); // (legs still in the saddle)
      }
      // a bundle on the back while carrying
      d.load.visible = !hidden && poolSize(d.view.carrying) > 0;
      d.load.position.set(Math.round(x) - d.view.dir * 7 - 4, WALK_Y - 40);
      // a bobbing "?" over a visitor waiting to be let in
      d.bubble.visible = d.visitor;
      d.bubble.position.set(Math.round(x) - 5, WALK_Y - 66 + Math.round(Math.sin(now / 300) * 1.5));
      // just got better at something
      const arrow = d.levelAt !== undefined && !hidden ? levelUpFrame((now - d.levelAt) / 160) : null;
      if (arrow && !d.levelUp) d.levelUp = this.layer.addChild(new Sprite());
      if (d.levelUp) {
        d.levelUp.visible = !!arrow;
        if (arrow) {
          d.levelUp.texture = arrow;
          d.levelUp.position.set(Math.round(x) - 16, WALK_Y - 60);
        }
      }
      // an emote over their head now and then (their mood at a glance)
      const emote = hidden || d.visitor || d.view.bleedMinutes !== null ? null : this.emoteFor(d, now);
      if (emote && !d.emote) d.emote = this.layer.addChild(new Sprite());
      if (d.emote) {
        d.emote.visible = !!emote;
        if (emote) {
          d.emote.texture = emoteFrame(emote, now / 140 + d.view.id)!;
          d.emote.position.set(Math.round(x) - EMOTE_SIZE / 2 + 6, WALK_Y - 62 + Math.round(Math.sin(now / 400 + d.view.id) * 1.5));
        }
      }
      // bleeding out: a pulsing drop of blood over them, and a bar of the time they have left
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
          d.blood.position.set(Math.round(x) - 4, WALK_Y - 40);
        }
      }
      // up in a castle's room: lifted to its floor (easing there, as if up the stairs)
      const want = d.view.floor !== null ? FLOOR_LIFT + d.view.floor * ROOM_H : 0;
      const dt = Math.min(0.1, (now - (d.liftAt ?? now)) / 1000);
      d.liftAt = now;
      d.lift = (d.lift ?? want) + Math.sign(want - (d.lift ?? want)) * Math.min(Math.abs(want - (d.lift ?? want)), CLIMB_SPEED * dt);
      if (d.lift) for (const o of [d.sprite, d.load, d.bubble, d.levelUp, d.emote, d.blood]) if (o?.visible) o.y -= Math.round(d.lift);
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
        // slow, thoughtful gestures (the first few spellcast frames, back and forth)
        return ['spell', [0, 1, 2, 3, 2, 1, 0, 0][Math.floor(secs * 2.5) % 8]];
      case 'eat':
        return ['spell', Math.floor(secs * 3) % 2]; // hand to mouth
      case 'fight':
        return ['thrust', cycle(secs, 1.2, FRAME_COUNT.thrust)];
      case 'sleep':
        return ['hurt', FRAME_COUNT.hurt - 1]; // lying down (sleeping outdoors)
      default:
        return ['walk', 0];
    }
  }

  /** The person (or visitor) under a local (fore-layer) point, if any. */
  personAt(localX: number, localY: number): PersonView | null {
    for (const d of this.drawn.values()) {
      if (d.view.indoors) continue;
      const up = Math.round(d.lift ?? 0);
      if (Math.abs(localX - d.x) <= HIT_HALF_W && localY <= WALK_Y - up && localY >= WALK_Y - HIT_H - up) return d.view;
    }
    return null;
  }

  /** Current drawn x of a person (for placing cards and tooltips). */
  xOf(id: number): number | null {
    return this.drawn.get(id)?.x ?? null;
  }
}

/** A tied bundle of goods, drawn behind a person's shoulders. */
function bundle(): Graphics {
  return new Graphics()
    .rect(0, 2, 9, 9).fill(0x5a3e24)
    .rect(1, 1, 7, 9).fill(0x8a6440)
    .rect(1, 5, 7, 1).fill(0x5a3e24)
    .rect(3, 0, 3, 2).fill(0x5a3e24);
}

/** A little speech bubble with a question mark. */
function questionBubble(): Graphics {
  const g = new Graphics().rect(0, 0, 11, 12).fill(0x2a1f17).rect(1, 1, 9, 10).fill(0xfff4d6).rect(4, 12, 3, 2).fill(0x2a1f17);
  // "?"
  return g.rect(3, 2, 5, 1).fill(0x2a1f17).rect(7, 3, 1, 2).fill(0x2a1f17).rect(5, 5, 2, 1).fill(0x2a1f17).rect(5, 6, 1, 1).fill(0x2a1f17).rect(5, 8, 1, 1).fill(0x2a1f17);
}

/** Play `frames` over the first 70% of each `period` seconds, then hold the first frame (a work rhythm). */
function cycle(secs: number, period: number, frames: number): number {
  const phase = (secs % period) / period;
  return phase < 0.7 ? Math.floor((phase / 0.7) * frames) : 0;
}
