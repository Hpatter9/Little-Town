// Watching a party away (an expedition, later a delve), in the manner of the old Final Fantasy games: between fights
// the party walks to the right through scenery that suits where they're going; when a fight starts the foes stand on
// the left and the party on the right, facing them, stepping forward to strike or cast, numbers popping up over whoever
// is hit or mended, a flash of the spell's colour where it lands. The sim does the fighting (combat.ts, actions.ts);
// this only shows it. The bars over and under it (the action's name, the names, health and time gauges) are in
// fightHud.ts.

import { Container, Graphics, Sprite, Text, TilingSprite } from 'pixi.js';
import { ABILITY_BY_ID } from '../../shared/data/abilities';
import type { Element } from '../../shared/data/effects';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import { SPELL_BY_ID } from '../../shared/data/spells';
import type { ExpeditionView, FighterView } from '../../shared/sim/snapshot';
import { creatureFlip, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { impactFrame, IMPACT_SIZE } from '../art/effects';
import { heldWeapon, wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { machineFrame, machineSize } from '../art/machines';
import { PAL } from '../art/palette';
import { mixHex, noTone, paint, type Painter } from '../art/pixelArt';
import { attackAnim, enemyLook } from '../art/rivals';
import { makeSpriteSet } from '../art/sprites';
import { stillTexture } from '../art/stills';
import { hash } from '../art/terrain';

/** How much of the scene is seen at least (art px): it's scaled so this fits, and shows more where there's room. */
const SEE_W = 170;
const SEE_H = 150;
/** The backdrop's size, and the row of it where the land meets the sky. */
const BACK_W = 320;
const BACK_H = 320;
const BACK_HORIZON = 200;
/** How much land shows below the horizon at most (the rest is sky). */
const LAND = 110;
const MARCH = 30;

/** Each element's colour for the flash where a spell or skill lands. */
const ELEMENT_COLOUR: Record<Element, number> = {
  physical: 0xffffff, fire: 0xff7030, ice: 0x9ae8ff, lightning: 0xfff070, holy: 0xffe8a0, dark: 0x8a40c0, nature: 0x6ad048, poison: 0x90f040,
  arcane: 0xc080ff, blood: 0xe03040, time: 0xb0a0ff, sound: 0xffc0e0, water: 0x40b0e0, earth: 0xc09060, wind: 0xd0f0e0,
};

/** The element of a spell or skill (for its flash), by id. */
function elementOf(id: string): Element {
  const effects = SPELL_BY_ID[id]?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? [];
  return effects.find((e) => e.element)?.element ?? (effects.some((e) => e.kind === 'heal' || e.kind === 'revive') ? 'holy' : 'arcane');
}

interface Figure {
  sprite: Sprite;
  pop: Text;
  spark: Sprite;
}

export class FightScene {
  readonly root = new Container();
  /** The whole screen behind the scene, so nothing of the town shows round it. */
  private readonly cover = new Graphics();
  private readonly clip = new Graphics();
  private readonly back = new TilingSprite({ width: BACK_W, height: BACK_H });
  /** What's seen (art px), and where the horizon is in it. */
  private vw = SEE_W;
  private vh = SEE_H;
  private hy = SEE_H - LAND;
  private readonly world = new Container();
  private readonly figures = new Container();
  private readonly fx = new Graphics();
  private readonly figs = new Map<string, Figure>();
  private sceneKey = '';
  private scroll = 0;
  private view: ExpeditionView | null = null;
  /** Spell and skill ids by name (the sim logs names; the flash wants the element). */
  private readonly idByName = new Map<string, string>();

  constructor() {
    this.root.visible = false;
    this.world.addChild(this.back, this.figures, this.fx);
    this.world.mask = this.clip;
    this.root.addChild(this.clip);
    this.root.addChild(this.cover, this.world);
    for (const s of Object.values(SPELL_BY_ID)) this.idByName.set(s.name, s.id);
    for (const a of Object.values(ABILITY_BY_ID)) this.idByName.set(a.name, a.id);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Fit the scene to its room: the width, above the panel along the bottom (px). */
  resize(w: number, h: number, top: number, bottom: number): void {
    const room = Math.max(40, h - top - bottom);
    this.cover.clear().rect(0, 0, w, h).fill(0x08081e);
    const k = Math.max(1, Math.min(w / SEE_W, room / SEE_H));
    this.vw = w / k;
    this.vh = room / k;
    this.hy = Math.round(this.vh - Math.min(this.vh * 0.6, LAND));
    this.world.scale.set(k);
    this.world.position.set(0, top);
    this.clip.clear().rect(0, top, w, room).fill(0xffffff);
    this.back.width = this.vw + 2;
    this.back.y = this.hy - BACK_HORIZON;
  }

  update(v: ExpeditionView | null): void {
    this.root.visible = !!v;
    this.view = v;
    if (!v) return;
    const key = `${v.id}|${v.scenery}`;
    if (key !== this.sceneKey) {
      this.sceneKey = key;
      const art = backdrop(v.scenery, v.id);
      this.back.texture = art.texture;
      for (const f of this.figs.values()) f.sprite.destroy();
      this.figures.removeChildren();
      this.figs.clear();
    }
  }

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    const fighting = !!v.battle?.length;
    // the ground scrolls under a party on the move (not while they fight or work)
    const walking = !fighting && (v.phase === 'out' || v.phase === 'back');
    if (walking) this.scroll = (this.scroll + MARCH * dt) % BACK_W;
    this.back.tilePosition.x = -Math.round(this.scroll);
    this.fx.clear();
    const seen = new Set<string>();
    if (fighting) this.drawFight(v.battle!, v, now, seen);
    else this.drawMarch(v, now, walking, seen);
    for (const [k, f] of this.figs) {
      if (seen.has(k)) continue;
      f.sprite.destroy();
      f.pop.destroy();
      f.spark.destroy();
      this.figs.delete(k);
    }
  }

  private fig(key: string): Figure {
    let f = this.figs.get(key);
    if (!f) {
      const sprite = new Sprite();
      const pop = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x101020, width: 2 } } });
      pop.anchor.set(0.5, 1);
      pop.resolution = 4;
      const spark = new Sprite();
      this.figures.addChild(sprite, spark, pop);
      f = { sprite, pop, spark };
      this.figs.set(key, f);
    }
    return f;
  }

  /** Between fights: the party in a line, walking to the right (or working at the site). */
  private drawMarch(v: ExpeditionView, now: number, walking: boolean, seen: Set<string>): void {
    const n = v.members.length;
    v.members.forEach((m, i) => {
      const key = `m${m.id}`;
      seen.add(key);
      const f = this.fig(key);
      const x = this.vw / 2 + (n - 1) * 9 - i * 18;
      const frame = walking ? 1 + (Math.floor(now / 100 + i * 3) % 8) : 0;
      f.sprite.texture = lpcFrame(m.look, walking ? 'walk' : 'thrust', walking ? frame : Math.floor(now / 160 + i) % FRAME_COUNT.thrust, heldWeapon(m.gear, 'walk'), wornLayers(m.gear));
      const k = 0.75;
      f.sprite.scale.set(k);
      f.sprite.position.set(Math.round(x - CENTRE_X * k), Math.round(this.hy + 40 - FEET_Y * k));
      f.sprite.zIndex = i;
      f.sprite.alpha = 1;
      f.sprite.tint = 0xffffff;
      f.pop.visible = false;
      f.spark.visible = false;
    });
  }

  /** A fight: foes on the left, the party on the right facing them. */
  private drawFight(fighters: FighterView[], v: ExpeditionView, now: number, seen: Set<string>): void {
    const foes = fighters.filter((f) => f.side === 'enemy');
    const party = fighters.filter((f) => f.side === 'party');
    const at = new Map<string, [number, number]>();
    const { vw, hy } = this;
    const land = this.vh - hy;
    const foeGap = Math.min(24, (land - 28) / 3);
    const partyGap = Math.min(16, (land - 24) / Math.max(1, party.length - 1));
    foes.forEach((f, i) => {
      // two columns, the big ones at the back
      const col = Math.floor(i / 3);
      const row = i % 3;
      at.set(`enemy:${f.ref}`, [Math.round(vw * 0.3) - col * 30 + (row % 2) * 9, Math.round(hy + 18 + row * foeGap)]);
    });
    party.forEach((f, i) => {
      // a slanting column, as in the old games
      at.set(`party:${f.ref}`, [Math.round(vw * 0.7) + i * 8 + (f.row === 'back' ? 12 : 0), Math.round(hy + 16 + i * partyGap)]);
    });
    // the spells and skills just used: a flash of their colour on whoever they touched
    for (const act of v.acts) {
      if (act.age > 8) continue;
      const colour = ELEMENT_COLOUR[elementOf(this.idByName.get(act.name) ?? '')];
      for (const ref of act.targets) {
        const p = at.get(`enemy:${ref}`) ?? at.get(`party:${ref}`);
        if (!p) continue;
        const k = act.age / 8;
        this.fx.circle(p[0], p[1] - 10, 6 + 10 * k).fill({ color: colour, alpha: 0.45 * (1 - k) });
        this.fx.circle(p[0], p[1] - 10, 3 + 14 * k).stroke({ width: 1, color: colour, alpha: 0.8 * (1 - k) });
      }
    }
    for (const f of fighters) {
      const key = `${f.side}:${f.ref}`;
      const p = at.get(key);
      if (!p) continue;
      seen.add(key);
      const g = this.fig(key);
      const acting = f.sinceAction < 6 && !f.down;
      // (they step out toward the foe to strike or cast)
      const step = acting ? (f.side === 'party' ? -10 : 8) : 0;
      this.pose(g.sprite, f, p[0] + step, p[1], acting, now);
      g.sprite.zIndex = p[1];
      g.sprite.alpha = f.down && f.side === 'enemy' ? Math.max(0, 1 - f.sinceHit / 20) : 1;
      g.sprite.tint = f.sinceHit < 3 && !f.down ? 0xff8080 : f.conjured || (f.side === 'party' && f.kind !== 'person') ? 0xa8f0b8 : 0xffffff;
      // the number over them: damage white, healing green, rising and fading
      const pop = f.pop && f.pop.age < 14 ? f.pop : null;
      g.pop.visible = !!pop && (pop.amount > 0 || !pop.heal);
      if (pop) {
        g.pop.text = pop.amount > 0 ? String(pop.amount) : 'Miss';
        g.pop.style.fill = pop.heal ? 0x8aff9a : 0xffffff;
        g.pop.position.set(p[0], p[1] - 22 - pop.age * 0.9);
        g.pop.alpha = Math.min(1, (14 - pop.age) / 5);
        g.pop.zIndex = 999;
      }
      const spark = f.sinceHit < 7 && !f.down ? impactFrame(f.sinceHit) : null;
      g.spark.visible = !!spark;
      if (spark) {
        g.spark.texture = spark;
        g.spark.width = g.spark.height = IMPACT_SIZE * 0.6;
        g.spark.position.set(p[0] - (IMPACT_SIZE * 0.3), p[1] - 26);
        g.spark.zIndex = 998;
      }
    }
    this.figures.sortableChildren = true;
  }

  /** A fighter's picture: a townsperson (or a raised foe) as an LPC figure, a creature, a still or a machine. */
  private pose(s: Sprite, f: FighterView, x: number, y: number, acting: boolean, now: number): void {
    const unit = f.kind === 'person' ? null : ENEMIES[f.kind];
    // (the party faces left, toward the foes; foes face right)
    const faceLeft = f.side === 'party';
    const k = 0.75;
    if (unit && 'sheet' in unit.sprite) {
      const sp = unit.sprite as { sheet: CreatureSheet; block: number; scale: number };
      const facing = faceLeft ? 'left' : 'right';
      s.texture = creatureFrame(sp.sheet, sp.block, facing, f.down ? 1 : Math.floor(now / 160 + f.ref), acting);
      const size = creatureSize(sp.sheet);
      const flip = creatureFlip(sp.sheet, facing);
      const sc = sp.scale * k * 1.2;
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - ((size.w * sc) / 2) * flip), Math.round(y - size.h * sc));
      return;
    }
    if (unit && 'still' in unit.sprite) {
      const st = unit.sprite as StillSprite;
      s.texture = stillTexture(st.still);
      const sc = st.scale * k;
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      const bob = st.hover && !f.down ? Math.round(Math.sin(now / 300 + f.ref) * 2) - 4 : 0;
      s.position.set(Math.round(x - ((s.texture.width * sc) / 2) * flip), Math.round(y - s.texture.height * sc + bob));
      return;
    }
    if (unit && 'machine' in unit.sprite) {
      const ms = unit.sprite as MachineSprite;
      s.texture = machineFrame(ms.machine, acting ? 3 : Math.floor(now / 160 + f.ref));
      const sc = ms.scale * k;
      const size = machineSize(ms.machine);
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - (size / 2) * sc * flip), Math.round(y - size * sc));
      return;
    }
    // people
    const hs = unit ? (unit.sprite as HumanSprite) : null;
    const enemy = hs ? enemyLook(hs.people, f.ref) : null;
    const look = f.look ?? enemy?.look;
    if (!look) return;
    const wear = enemy ? enemy.wear : wornLayers(f.gear);
    const weapon = hs ? hs.weapon : heldWeapon(f.gear, 'fight');
    let anim: LpcAnim = 'walk';
    let frame = 0;
    if (f.down) {
      anim = 'hurt';
      frame = FRAME_COUNT.hurt - 1;
    } else if (acting) {
      anim = hs ? attackAnim(hs, f.ranged) : weapon === 'bow' ? 'shoot' : f.ranged ? 'spell' : weapon === 'spear' ? 'thrust' : 'slash';
      frame = Math.min(FRAME_COUNT[anim] - 1, Math.floor(f.sinceAction * (anim === 'shoot' ? 1.6 : 1)));
    }
    s.texture = lpcFrame(look, anim, frame, f.ranged && weapon !== 'bow' ? null : weapon, wear);
    const flip = faceLeft ? -1 : 1;
    s.scale.set(k * flip, k);
    s.position.set(Math.round(x - (flip > 0 ? CENTRE_X : -CENTRE_X - 1) * k), Math.round(y - FEET_Y * k));
  }
}

/* ------------------------------------------------------------ the backdrop */

/** The scenery behind a fight: sky and far land over a ground that runs back, in the colours of where they are. */
function backdrop(scenery: string, seed: number) {
  const cave = scenery === 'cave';
  const rocky = cave || scenery === 'quarry';
  const sky = cave ? ['#1a1620', '#2a2430'] : ['#5a8ac8', '#a8c8e8'];
  const ground = rocky ? PAL.rock : scenery === 'woods' ? PAL.grassDark : PAL.grass;
  const set = makeSpriteSet(0x5ee0 + seed, noTone);
  return paint(
    BACK_W,
    BACK_H,
    noTone,
    (p: Painter) => {
      // sky, banded
      const horizon = BACK_HORIZON;
      for (let y = 0; y < horizon; y++) p.rect(0, y, BACK_W, 1, mixHex(sky[0], sky[1], y / horizon));
      // far land: hills or a cave's back wall
      for (let x = 0; x < BACK_W; x++) {
        // (whole waves across the width, so it tiles as it scrolls)
        const t = (x / BACK_W) * Math.PI * 2;
        const h = Math.round(12 + 9 * Math.sin(t * 2 + seed) + 5 * Math.sin(t * 9 + seed * 3) + hash(seed, x, 1) * 2);
        p.rect(x, horizon - h, 1, h, cave ? '#3a3440' : mixHex(PAL.grassDark, sky[1], 0.45));
      }
      // the ground running back: lighter far, darker near, with streaks along it
      for (let y = horizon; y < BACK_H; y++) p.rect(0, y, BACK_W, 1, mixHex(mixHex(ground, sky[1], 0.25), ground, (y - horizon) / (BACK_H - horizon)));
      for (let k = 0; k < 220; k++) {
        const x = Math.floor(hash(seed, k, 3) * BACK_W);
        const y = horizon + 2 + Math.floor(hash(seed, k, 4) ** 0.7 * (BACK_H - horizon - 3));
        p.rect(x, y, 2 + Math.floor((y - horizon) / 18), 1, hash(seed, k, 5) < 0.5 ? (rocky ? PAL.rockDark : PAL.grassDark) : rocky ? PAL.rockLight : PAL.grassLight);
      }
      if (scenery === 'river') for (let y = horizon + 4; y < horizon + 12; y++) p.rect(0, y, BACK_W, 1, mixHex(PAL.water, PAL.waterLight, (y - horizon - 4) / 8));
      // a few trees or rocks on the far edge (the scenery set's own)
      const list = rocky ? set.boulder : scenery === 'woods' ? set.pine : set.broadleaf;
      for (let k = 0; k < 6; k++) {
        const art = list[k % list.length];
        const x = Math.floor(hash(seed, k, 7) * (BACK_W - 20));
        p.ctx.drawImage(art.texture.source.resource as CanvasImageSource, x, horizon - Math.round(art.height * 0.6) + 3, art.width * 0.6, art.height * 0.6);
      }
    },
    1,
    { stuff: false, tile: true },
  );
}

