// The split-view pane: while a party is away, the right of the strip shows them marching in a line
// through scenery that suits their destination (DESIGN §8). The ground scrolls under them; at the
// destination they stop at a landmark and work.

import { Container, Graphics, Sprite } from 'pixi.js';
import { BACK_GROUND_Y, FORE_TOP_Y, MID_GROUND_Y, STRIP_HEIGHT } from '../../shared/constants';
import type { Look } from '../../shared/data/people';
import { Rng } from '../../shared/rng';
import { ENEMIES } from '../../shared/data/enemies';
import type { ExpeditionView, FighterView } from '../../shared/sim/snapshot';
import { CREATURE_FRAME, creatureFlip, creatureFrame, creatureSize, creatureTop, type CreatureSheet } from '../art/creatures';
import { attackAnim, enemyLook } from '../art/rivals';
import { BLOOD_SIZE, bloodFrame, fireHitFrame, FLAME_SIZE, IMPACT_SIZE, impactFrame, lightningHitFrame, placeArea } from '../art/effects';
import { PAL } from '../art/palette';
import { haze, hexToNum, noTone } from '../art/pixelArt';
import { loadScenery, withPackScenery } from '../art/scenery';
import { heldWeapon, wornLayers } from '../art/held';

const HORSE_SCALE = 0.85;
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import type { HumanSprite, MachineSprite, StillSprite } from '../../shared/data/enemies';
import { stillTexture } from '../art/stills';
import { hkLayers, hkPose, hkWhoById } from '../art/hkFolk';
import { hkSprite } from '../art/hkTexture';
import type { Slot } from '../../shared/data/items';
import { machineFrame, machineSize } from '../art/machines';
import { makeSpriteSet, type SpriteSet } from '../art/sprites';
import { daylightTint } from '../map/mapView';

/** Width of one repeat of the scenery. */
const LOOP = 768;
const MARCH_SPEED = 48; // px per second, same as walking in town
const FAR_PARALLAX = 0.3;
const SPACING = 24;
const WALK_Y = FORE_TOP_Y + 20;
const FAR_TONE = haze(0.5);

type Theme = 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';

export class ExpeditionPane {
  readonly root = new Container();
  private readonly mask = new Graphics();
  private readonly far = new Container();
  private readonly near = new Container();
  private readonly landmark = new Container();
  private readonly party = new Container();
  private readonly battleLayer = new Container();
  private battleKey = '';
  private readonly fighterSprites = new Map<string, { sprite: Sprite; bar: Graphics; spark: Sprite; blast: Sprite }>();
  private readonly frame = new Graphics();
  private sprites: SpriteSet;
  private farSprites: SpriteSet;
  private shownId: number | null = null;
  private view: ExpeditionView | null = null;
  private scroll = 0;
  private width = 0;
  private members: { sprite: Sprite; load: Graphics; id: number; look: Look; gear: Partial<Record<Slot, string>>; wear: string[] }[] = [];
  private horses: { sprite: Sprite; coat: number }[] = [];
  private truck: Graphics | null = null;

  constructor(seedHash: number) {
    this.sprites = makeSpriteSet(seedHash ^ 0x61, noTone);
    this.farSprites = makeSpriteSet(seedHash ^ 0x62, FAR_TONE);
    // (the packs' trees, bushes and rocks take over once loaded: art/scenery.ts)
    void loadScenery().then(() => {
      this.sprites = withPackScenery(this.sprites, noTone, 'near', 'forest', 'summer');
      this.farSprites = withPackScenery(this.farSprites, FAR_TONE, 'pane-far', 'forest', 'summer');
    });
    this.root.addChild(this.far, this.near, this.landmark, this.party, this.battleLayer, this.frame, this.mask);
    this.root.mask = this.mask;
    this.root.visible = false;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Place the pane at screen x0 with the given width (the strip's bottom-anchored coordinates). */
  layout(x0: number, width: number, screenH: number): void {
    this.width = width;
    this.root.position.set(Math.round(x0), Math.round(screenH - STRIP_HEIGHT));
    this.mask.clear().rect(0, 0, width, STRIP_HEIGHT).fill(0xffffff);
    // a post at the left edge separates the pane from the town
    this.frame
      .clear()
      .rect(0, 70, 4, STRIP_HEIGHT - 70)
      .fill(0x3b2616)
      .rect(1, 70, 1, STRIP_HEIGHT - 70)
      .fill(0x77502f)
      .rect(-2, 66, 8, 6)
      .fill(0x5a3a22);
  }

  /** Show an expedition (or hide the pane with null). */
  show(v: ExpeditionView | null): void {
    this.view = v;
    this.root.visible = !!v;
    if (!v) {
      this.shownId = null;
      return;
    }
    if (v.id !== this.shownId) {
      this.shownId = v.id;
      this.buildScenery(v.scenery as Theme, v.id);
      this.buildParty(
        v.members.map((m) => ({ id: m.id, look: m.look, gear: m.gear, wear: wornLayers(m.gear) })),
        v.horses,
        v.truck,
      );
      this.scroll = 0;
    }
  }

  setDaylight(daylight: number): void {
    this.root.tint = daylightTint(daylight);
  }

  /** Scroll the ground and animate the party (or the fight). */
  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    this.party.visible = !v.battle;
    this.battleLayer.visible = !!v.battle;
    if (v.battle) {
      this.renderBattle(v.battle, v.id, now);
      return;
    }
    const walking = v.phase !== 'work' && !v.waiting;
    const dir = v.phase === 'back' ? -1 : 1; // out: away from town (rightward); back: toward town
    // a truck drives the party there, much faster than walking
    const driving = walking && !!this.truck;
    if (walking) this.scroll += dir * MARCH_SPEED * (driving ? 2.5 : 1) * dt;
    const wrap = (x: number) => ((x % LOOP) + LOOP) % LOOP;
    this.near.x = -wrap(this.scroll);
    this.far.x = -wrap(this.scroll * FAR_PARALLAX);

    // The landmark slides in over the last stretch of the walk out, stays while working, and leaves on the way back.
    const site = this.width / 2 + 80; // where the landmark stands while they work, just ahead of the party
    const offscreen = this.width + 80;
    let lx: number | null = null;
    if (v.phase === 'out' && v.phaseProgress > 0.85) lx = offscreen - ((v.phaseProgress - 0.85) / 0.15) * (offscreen - site);
    else if (v.phase === 'work') lx = site;
    else if (v.phase === 'back' && v.phaseProgress < 0.15) lx = site + (v.phaseProgress / 0.15) * (offscreen - site);
    this.landmark.visible = lx !== null;
    if (lx !== null) this.landmark.x = Math.round(lx);

    const secs = now / 1000;
    const n = this.members.length;
    this.members.forEach((m, i) => {
      // leader in front: rightmost when heading out, leftmost when heading back
      const slot = dir > 0 ? n - 1 - i : i;
      const x = Math.round(this.width / 2 - ((n - 1) * SPACING) / 2 + slot * SPACING + (v.phase === 'work' ? 20 : 0));
      let anim: 'walk' | 'spell' | 'thrust' = 'walk';
      let frame = 1 + (Math.floor(secs * 10 + i * 3) % 8);
      if (!walking) {
        const hunt = v.scenery === 'woods' || v.scenery === 'cave';
        anim = hunt || v.scenery === 'quarry' || v.scenery === 'river' ? 'thrust' : 'spell';
        const count = FRAME_COUNT[anim];
        const phase = ((secs + i * 0.37) % 1.1) / 1.1;
        frame = phase < 0.7 ? Math.floor((phase / 0.7) * count) : 0;
      }
      const flip = walking ? dir < 0 : false;
      // (in the Himeko look, as the map draws them: art/hkFolk.ts; the old look while their layers load)
      const keys = hkLayers(hkWhoById(m.id, m.look, m.gear), { fighting: false, activity: walking ? 'idle' : anim === 'thrust' ? 'chop' : 'build' });
      const col = walking ? [1, 0, 2, 0][Math.floor(secs * 7 + i * 3) % 4] : frame ? (frame % 2 ? 3 : 4) : 0;
      if (!hkSprite(m.sprite, keys, col, flip ? 1 : 2, x, WALK_Y, 48)) {
        m.sprite.anchor.set(0);
        m.sprite.texture = lpcFrame(m.look, anim, frame, null, m.wear);
        m.sprite.scale.set(flip ? -1 : 1, 1);
        m.sprite.x = x + (flip ? CENTRE_X + 1 : -CENTRE_X);
        m.sprite.y = WALK_Y - FEET_Y;
      }
      m.load.visible = v.phase === 'back' && v.lootSize > 0;
      m.load.position.set(x - (flip ? -1 : 1) * 7 - 4, WALK_Y - 40);
    });
    if (this.truck) {
      // on the road they ride in the truck; at the site it's parked behind them
      for (const m of this.members) {
        m.sprite.visible = !driving;
        if (driving) m.load.visible = false;
      }
      this.truck.scale.x = driving ? dir : 1;
      this.truck.x = Math.round(driving ? this.width / 2 : this.width / 2 - ((n - 1) * SPACING) / 2 - 40);
      this.truck.y = WALK_Y + 3 + (driving ? Math.round(Math.sin(secs * 18)) * 0.5 : 0);
    }
    // horses trail behind the last of the party
    const tail = this.width / 2 - ((n - 1) * SPACING) / 2 - (dir > 0 ? 0 : -(n - 1) * SPACING);
    this.horses.forEach((h, i) => {
      const x = Math.round(tail - dir * (34 + i * 30));
      const frame = walking ? Math.floor(secs * 6 + i) % 3 : 1;
      h.sprite.texture = creatureFrame('horse', h.coat, walking && dir < 0 ? 'left' : 'right', frame);
      h.sprite.x = Math.round(x - (CREATURE_FRAME * HORSE_SCALE) / 2);
      h.sprite.y = Math.round(WALK_Y + 2 - CREATURE_FRAME * HORSE_SCALE);
    });
  }

  /* ------------------------------------------------------------ fights */

  private renderBattle(fighters: FighterView[], expeditionId: number, now: number): void {
    const key = `${expeditionId}|${fighters.map((f) => f.side + f.ref + f.kind).join(',')}`;
    if (key !== this.battleKey) {
      this.battleKey = key;
      this.battleLayer.removeChildren().forEach((c) => c.destroy());
      this.fighterSprites.clear();
      for (const f of fighters) {
        const sprite = this.battleLayer.addChild(new Sprite());
        const bar = this.battleLayer.addChild(new Graphics());
        const spark = this.battleLayer.addChild(new Sprite());
        const blast = this.battleLayer.addChild(new Sprite());
        blast.scale.set(1.5);
        this.fighterSprites.set(`${f.side}:${f.ref}`, { sprite, bar, spark, blast });
      }
    }
    const secs = now / 1000;
    const slot = { 'party:front': 0, 'party:back': 0, 'enemy:front': 0, 'enemy:back': 0 } as Record<string, number>;
    for (const f of fighters) {
      const d = this.fighterSprites.get(`${f.side}:${f.ref}`);
      if (!d) continue;
      const k = `${f.side}:${f.row}`;
      const i = slot[k]++;
      const baseX =
        f.side === 'party'
          ? (f.row === 'front' ? this.width * 0.42 : this.width * 0.28) - i * 18
          : (f.row === 'front' ? this.width * 0.58 : this.width * 0.8) + i * 30;
      const acting = f.sinceAction < 6;
      const x = Math.round(baseX + (acting && !f.down ? (f.side === 'party' ? 5 : -5) : 0));
      const s = d.sprite;
      let top = WALK_Y - 50;
      // (allies on our side, summoned or raised, are drawn from their unit def and face right)
      const unit = f.kind === 'person' ? null : ENEMIES[f.kind];
      const faceLeft = f.side === 'enemy';
      const machine = unit && 'machine' in unit.sprite ? (unit.sprite as MachineSprite) : null;
      const still = unit && 'still' in unit.sprite ? (unit.sprite as StillSprite) : null;
      if (still) {
        s.texture = stillTexture(still.still);
        const flip = faceLeft ? -1 : 1;
        s.scale.set(still.scale * flip, still.scale);
        const w = s.texture.width * still.scale;
        const bob = still.hover && !f.down ? Math.round(Math.sin(secs * 3 + f.ref) * 2) - 6 : 0;
        s.x = Math.round(x - (w / 2) * flip);
        s.y = Math.round(WALK_Y + 2 - s.texture.height * still.scale + bob);
        top = s.y + 4;
      } else if (machine) {
        s.texture = machineFrame(machine.machine, acting && !f.down ? 3 : Math.floor(secs * 6 + f.ref));
        s.scale.set((faceLeft ? -1 : 1) * machine.scale, machine.scale);
        const size = machineSize(machine.machine);
        s.x = Math.round(x + (faceLeft ? 1 : -1) * (size / 2) * machine.scale);
        s.y = Math.round(WALK_Y + 2 - size * machine.scale);
        top = s.y + 4;
      } else if (!unit || !('sheet' in unit.sprite)) {
        // people (ours face right; rival tribesmen face left)
        const hs = unit ? (unit.sprite as HumanSprite) : null;
        const enemy = hs ? enemyLook(hs.people, f.ref) : null;
        const look = f.look ?? enemy!.look;
        // (a townsperson in the Himeko look, as the map draws them)
        const hkKeys = !hs && f.look ? hkLayers(hkWhoById(f.ref, f.look, f.gear), { fighting: true, activity: 'fight' }) : null;
        const [hc, hr] = hkPose({ facing: faceLeft ? 'left' : 'right', moving: false, walked: 0, working: false, sinceBlow: acting ? f.sinceAction : 999, sinceHit: f.sinceHit, down: f.down, ranged: f.ranged, now: secs * 1000 });
        if (hkKeys && hkSprite(s, hkKeys, hc, hr, x, WALK_Y, 48)) {
          top = WALK_Y - 50;
        } else {
          s.anchor.set(0);
          const wear = enemy ? enemy.wear : wornLayers(f.gear);
          const weapon = hs ? hs.weapon : heldWeapon(f.gear, 'fight');
          let anim: LpcAnim = 'walk';
          let frame = 0;
          if (f.down) {
            anim = 'hurt';
            frame = FRAME_COUNT.hurt - 1;
          } else if (acting) {
            if (hs) anim = attackAnim(hs, f.ranged);
            else if (weapon === 'bow') anim = 'shoot';
            else if (f.role === 'medic' || f.ranged) anim = 'spell';
            else anim = weapon && weapon !== 'spear' ? 'slash' : 'thrust';
            frame = Math.min(FRAME_COUNT[anim] - 1, Math.floor(f.sinceAction * (anim === 'shoot' ? 1.6 : 1)));
          }
          s.texture = lpcFrame(look, anim, frame, f.ranged && weapon !== 'bow' ? null : weapon, wear);
          const flip = faceLeft;
          s.scale.set(flip ? -1 : 1, 1);
          s.x = x + (flip ? CENTRE_X + 1 : -CENTRE_X);
          s.y = WALK_Y - FEET_Y;
        }
      } else {
        const sp = ENEMIES[f.kind].sprite as { sheet: CreatureSheet; block: number; scale: number };
        const facing = faceLeft ? 'left' : 'right';
        s.texture = creatureFrame(sp.sheet, sp.block, facing, f.down ? 1 : Math.floor(secs * 6 + f.ref), acting && !f.down, f.down ? 'dead' : undefined);
        const size = creatureSize(sp.sheet);
        const flip = creatureFlip(sp.sheet, facing);
        s.scale.set(sp.scale * flip, sp.scale);
        s.x = Math.round(x - ((size.w * sp.scale) / 2) * flip);
        s.y = Math.round(WALK_Y + 4 - size.h * sp.scale);
        top = s.y + 6 + Math.round(size.h * sp.scale * creatureTop(sp.sheet));
      }
      s.alpha = f.down && f.side === 'enemy' ? 0.35 : 1;
      s.tint = f.sinceHit < 3 && !f.down ? 0xff7070 : 0xffffff;
      // (enemies face left, toward the party)
      placeArea(d.blast, ENEMIES[f.kind]?.kit?.area?.fx, f.sinceArea, x, f.side === 'enemy' ? -1 : 1, WALK_Y);
      // (a Blood Knight's blows burst with blood)
      // (and gunshots and lasers burst with fire and lightning)
      const spark = f.hitFx === 'blood' ? bloodFrame(f.sinceHit) : f.hitFx === 'fire' ? fireHitFrame(f.sinceHit * 1.2) : f.hitFx === 'lightning' ? lightningHitFrame(f.sinceHit * 1.2) : impactFrame(f.sinceHit);
      const size = f.hitFx === 'blood' ? BLOOD_SIZE : f.hitFx ? FLAME_SIZE : IMPACT_SIZE;
      d.spark.visible = !!spark;
      if (spark) {
        d.spark.texture = spark;
        d.spark.position.set(x - size / 2, top + 4 - (size - IMPACT_SIZE) / 2);
      }
      // health bar
      const w = 20;
      d.bar.clear();
      if (!f.down) {
        d.bar
          .rect(x - w / 2 - 1, top - 5, w + 2, 4)
          .fill({ color: 0x1a120c, alpha: 0.85 })
          .rect(x - w / 2, top - 4, Math.max(1, Math.round((w * f.hp) / f.maxHp)), 2)
          .fill(f.side === 'party' ? 0x8cc05a : 0xe06040);
      }
    }
  }

  /* ------------------------------------------------------------ building */

  private buildParty(members: { id: number; look: Look; gear: Partial<Record<Slot, string>>; wear: string[] }[], horses: number[], truck: boolean): void {
    this.party.removeChildren().forEach((c) => c.destroy());
    this.truck = truck ? this.party.addChild(truckArt()) : null;
    // horses first, so they're drawn behind the people
    this.horses = horses.map((coat) => {
      const sprite = this.party.addChild(new Sprite());
      sprite.scale.set(HORSE_SCALE);
      return { sprite, coat };
    });
    this.members = members.map(({ id, look, gear, wear }) => {
      const load = this.party.addChild(bundle());
      const sprite = this.party.addChild(new Sprite());
      return { sprite, load, id, look, gear, wear };
    });
  }

  private buildScenery(theme: Theme, seed: number): void {
    for (const c of [this.far, this.near, this.landmark]) c.removeChildren().forEach((o) => o.destroy());
    for (const copy of [0, LOOP]) {
      this.far.addChild(this.farRidge(theme, seed)).x = copy;
      this.near.addChild(this.nearLoop(theme, seed)).x = copy;
    }
    // one more copy so a wide pane never shows a gap
    this.far.addChild(this.farRidge(theme, seed)).x = LOOP * 2;
    this.near.addChild(this.nearLoop(theme, seed)).x = LOOP * 2;
    this.landmark.addChild(this.buildLandmark(theme, seed));
  }

  /** Distant hills: a seamless heightfield across one loop. */
  private farRidge(theme: Theme, seed: number): Container {
    const c = new Container();
    const g = c.addChild(new Graphics());
    const rng = new Rng(seed ^ 0x9f);
    const a = rng.range(0, 6);
    const tall = theme === 'quarry' || theme === 'cave' ? 1.6 : 1;
    for (let x = 0; x < LOOP; x += 4) {
      const t = (x / LOOP) * Math.PI * 2;
      const h = Math.round((20 + 10 * Math.sin(t * 2 + a) + 7 * Math.sin(t * 5 + a * 2)) * tall);
      g.rect(x, BACK_GROUND_Y - h, 4, h).fill(hexToNum(FAR_TONE(theme === 'quarry' || theme === 'cave' ? PAL.rock : PAL.grass)));
    }
    // background trees for leafy themes
    if (theme === 'woods' || theme === 'thicket') {
      for (let x = 10; x < LOOP - 10; x += rng.int(18, 40)) {
        const art = rng.pick(theme === 'woods' ? this.farSprites.pine : this.farSprites.broadleaf);
        const s = c.addChild(new Sprite(art.texture));
        s.scale.set(0.6);
        s.position.set(x - art.width * 0.3, BACK_GROUND_Y + 4 - art.height * 0.6);
      }
    }
    return c;
  }

  /** Ground, scenery and walkway for one loop. */
  private nearLoop(theme: Theme, seed: number): Container {
    const c = new Container();
    const g = c.addChild(new Graphics());
    const rng = new Rng(seed ^ 0x5a);
    const ground = theme === 'quarry' || theme === 'cave' ? PAL.rock : theme === 'woods' ? PAL.grassDark : PAL.grass;
    g.rect(0, BACK_GROUND_Y, LOOP, FORE_TOP_Y - BACK_GROUND_Y).fill(hexToNum(FAR_TONE(ground)));
    if (theme === 'river') g.rect(0, BACK_GROUND_Y + 6, LOOP, 12).fill(hexToNum(FAR_TONE(PAL.water)));
    g.rect(0, MID_GROUND_Y - 8, LOOP, 10).fill(hexToNum(ground));
    // walkway: a trail through rough ground
    g.rect(0, FORE_TOP_Y, LOOP, STRIP_HEIGHT - FORE_TOP_Y).fill(hexToNum(theme === 'quarry' || theme === 'cave' ? PAL.rockDark : PAL.grass));
    g.rect(0, FORE_TOP_Y + 12, LOOP, 7).fill(hexToNum(PAL.dirt));
    for (let k = 0; k < 40; k++) g.rect(rng.int(0, LOOP - 3), rng.pick([FORE_TOP_Y + rng.int(2, 10), FORE_TOP_Y + rng.int(20, 26)]), 3, 1).fill(hexToNum(PAL.grassLight));

    const s = this.sprites;
    const place = (arts: SpriteSet[keyof SpriteSet], x: number, bottom: number) => {
      const art = rng.pick(arts);
      const sp = c.addChild(new Sprite(art.texture));
      sp.position.set(Math.round(x - art.width / 2), Math.round(bottom - art.height));
    };
    // keep objects away from the loop seam so copies join cleanly
    for (let x = 30; x < LOOP - 30; x += rng.int(28, 60)) {
      const base = MID_GROUND_Y - rng.int(0, 6);
      switch (theme) {
        case 'thicket':
          place(rng.chance(0.6) ? s.bush : s.broadleaf, x, base);
          break;
        case 'river':
          place(rng.chance(0.6) ? s.reeds : rng.chance(0.5) ? s.bush : s.broadleaf, x, base);
          break;
        case 'woods':
          place(rng.chance(0.6) ? s.pine : s.broadleaf, x, base);
          break;
        case 'quarry':
          place(rng.chance(0.5) ? s.boulder : s.outcrop, x, base);
          break;
        case 'cave':
          place(rng.chance(0.4) ? s.pine : rng.chance(0.5) ? s.outcrop : s.boulder, x, base);
          break;
      }
    }
    for (let x = 20; x < LOOP - 20; x += rng.int(30, 70)) place(rng.chance(0.7) ? s.tuft : s.flowers, x, FORE_TOP_Y + rng.int(1, 4));
    return c;
  }

  /** What they find at the destination. Drawn with its centre at x = 0. */
  private buildLandmark(theme: Theme, seed: number): Container {
    const c = new Container();
    const g = c.addChild(new Graphics());
    const rng = new Rng(seed ^ 0x33);
    const s = this.sprites;
    const add = (arts: SpriteSet[keyof SpriteSet], x: number, bottom: number) => {
      const art = rng.pick(arts);
      const sp = c.addChild(new Sprite(art.texture));
      sp.position.set(Math.round(x - art.width / 2), Math.round(bottom - art.height));
    };
    switch (theme) {
      case 'thicket':
        for (const x of [-30, -8, 14, 34]) add(s.bush, x, FORE_TOP_Y + 2);
        break;
      case 'river':
        g.ellipse(0, FORE_TOP_Y + 14, 60, 9).fill(hexToNum(PAL.waterDark)).ellipse(-4, FORE_TOP_Y + 12, 50, 6).fill(hexToNum(PAL.water));
        for (const x of [-52, 46]) add(s.reeds, x, FORE_TOP_Y + 8);
        break;
      case 'woods':
        for (const x of [-40, 0, 36]) add(s.pine, x, MID_GROUND_Y + 2);
        break;
      case 'quarry':
        for (const x of [-34, 10, 40]) add(s.outcrop, x, FORE_TOP_Y + 4);
        break;
      case 'cave':
        g.ellipse(0, MID_GROUND_Y, 70, 58).fill(hexToNum(PAL.rockDark)).ellipse(-6, MID_GROUND_Y - 4, 62, 50).fill(hexToNum(PAL.rock));
        g.ellipse(0, MID_GROUND_Y + 2, 26, 30).fill(0x140e0c);
        g.rect(-70, MID_GROUND_Y, 140, 4).fill(hexToNum(PAL.rockDark));
        break;
    }
    return c;
  }
}

function bundle(): Graphics {
  return new Graphics().rect(0, 2, 9, 9).fill(0x5a3e24).rect(1, 1, 7, 9).fill(0x8a6440).rect(1, 5, 7, 1).fill(0x5a3e24).rect(3, 0, 3, 2).fill(0x5a3e24);
}

/** A flatbed truck facing right, centred on x = 0 with its wheels on y = 0. */
function truckArt(): Graphics {
  const g = new Graphics();
  // bed and cab
  g.rect(-30, -16, 34, 10).fill(0x4f5d43).rect(-30, -18, 34, 3).fill(0x66784f);
  g.rect(-28, -24, 30, 7).fill(0x6b4b2a).rect(-28, -24, 30, 1).fill(0x8a6440); // the load under a tarp
  g.rect(4, -26, 18, 20).fill(0x5f7a4a).rect(4, -26, 18, 2).fill(0x7c9a62);
  g.rect(12, -23, 8, 7).fill(0x9fc4d4).rect(12, -23, 8, 2).fill(0xd4ecf4); // window
  g.rect(22, -12, 6, 6).fill(0x3e4a34).rect(26, -11, 2, 2).fill(0xf2e08a); // bonnet and lamp
  g.rect(-31, -7, 60, 2).fill(0x2a2a2a);
  // wheels
  for (const x of [-20, 16]) g.circle(x, -3, 5).fill(0x1c1c1c).circle(x, -3, 2).fill(0x8a8a8a);
  return g;
}