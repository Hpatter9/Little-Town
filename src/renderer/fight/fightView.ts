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
import { BACK_H, BACK_HORIZON, BACK_W, fightBackdrop, FRONT_H, sceneFor, type Backdrop, type SceneId } from '../art/fightBackdrop';
import type { Biome } from '../../shared/data/biomes';
import { attackAnim, enemyLook } from '../art/rivals';
import { stillTexture } from '../art/stills';

/** How much of the scene is seen at least (art px): it's scaled so this fits, and shows more where there's room. */
const SEE_W = 170;
const SEE_H = 150;
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
  /** The scenery's layers, back to front, and how fast each scrolls by as the party walks. */
  private readonly layers = [new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: FRONT_H })];
  private backdrop: Backdrop | null = null;
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
  private drift = 0;
  private view: ExpeditionView | null = null;
  /** Spell and skill ids by name (the sim logs names; the flash wants the element). */
  private readonly idByName = new Map<string, string>();

  constructor() {
    this.root.visible = false;
    this.world.addChild(...this.layers.slice(0, 3), this.layers[3], this.figures, this.fx);
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
    // (indoors, a little more of the wall shows: that's where the torches and banners are)
    this.hy = Math.round(this.vh - Math.min(this.vh * (this.backdrop?.indoor ? 0.5 : 0.6), LAND));
    this.world.scale.set(k);
    this.world.position.set(0, top);
    this.clip.clear().rect(0, top, w, room).fill(0xffffff);
    for (const l of this.layers) l.width = this.vw + 2;
    for (const l of this.layers.slice(0, 3)) l.y = this.hy - BACK_HORIZON;
    this.layers[3].y = Math.round(this.vh - FRONT_H + 8);
  }

  update(v: ExpeditionView | null, biome?: Biome): void {
    this.root.visible = !!v;
    this.view = v;
    if (!v) return;
    // (on the road it's the land on the way; arrived at a dungeon, it's inside)
    // (`window.__scene` shows any scene, for previews)
    const scene = (window as unknown as { __scene?: SceneId }).__scene ?? sceneFor(v.dest, v.scenery, v.phase, biome);
    const key = `${v.id}|${scene}`;
    if (key !== this.sceneKey) {
      this.sceneKey = key;
      const art = fightBackdrop(scene, v.id);
      this.backdrop = art;
      [art.far, art.mid, art.near, art.front].forEach((a, i) => (this.layers[i].texture = a.texture));
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
    if (walking) this.scroll += MARCH * dt;
    // (the clouds drift a little even while they stand)
    this.drift += dt * 1.5;
    const b = this.backdrop;
    if (b) this.layers.forEach((l, i) => (l.tilePosition.x = -Math.round((this.scroll * b.pace[i] + (i === 0 && !b.indoor ? this.drift : 0)) % BACK_W)));
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
    // (in a staggered line back from the front, spaced so the big ones don't stand in each other)
    const spacing = Math.min(40, (vw * 0.32) / Math.max(1, foes.length - 1));
    foes.forEach((f, i) => {
      at.set(`enemy:${f.ref}`, [Math.round(vw * 0.36 - i * spacing), Math.round(hy + 18 + (i % 2) * foeGap * 1.6)]);
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
      s.texture = creatureFrame(sp.sheet, sp.block, facing, f.down ? 1 : Math.floor(now / 160 + f.ref), acting, f.down ? 'dead' : acting ? undefined : 'idle');
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
