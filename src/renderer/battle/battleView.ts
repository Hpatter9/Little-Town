// The battle on the trail, drawn (sim/battle.ts has the rules). It takes over the strip while a battle is on: the map
// built from the town (its ground painted by art/battleArt.ts; the town's own buildings, in its style, along the trail;
// trees and rocks in the wild parts), the fighters on their spots, the raiders walking the trail, shots, spells and
// health bars. Upright the trail runs down the screen; sideways, across it. The map fills the screen across and
// scrolls along: it follows the raiders furthest along unless the player has just dragged it.

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { ITEM_BY_ID } from '../../shared/data/items';
import { AIM_RADIUS, type BattleMap, type BattleView as BattleSnap } from '../../shared/sim/battle';
import type { PersonView, RaiderView, Snapshot } from '../../shared/sim/snapshot';
import { buildingArt } from '../art/buildings';
import { battleGround, CELL, toArt, trailCells } from '../art/battleArt';
import { creatureFeet, creatureFlip, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { blastFrame, castFrame, impactFrame, AREA_SIZE, BLAST_SIZE, IMPACT_SIZE } from '../art/effects';
import { heldWeapon, wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { machineFrame, machineSize } from '../art/machines';
import { noTone, type PixelArt } from '../art/pixelArt';
import { attackAnim, enemyLook } from '../art/rivals';
import { makeSpriteSet, type SpriteSet } from '../art/sprites';
import { stillTexture } from '../art/stills';
import { PAL } from '../art/palette';
import { glowTexture } from '../town/layer';
import { CLASS_LOOK } from '../town/peopleView';
import { LOOKS } from '../town/spellLooks';
import { SHEETS } from '../town/spellsView';
import { actIdOf, actSprite } from '../fight/actLooks';

/** Characters are drawn at this share of their town size (a cell is half a town tile). */
const FIGURE = 0.4;
/** After the player drags the map, it waits this long before following the raiders again. */
const FOLLOW_WAIT_MS = 4000;
/** How far a mage's fire is drawn bursting (cells: as the sim's burst). */
const MAGE_BURST_DRAWN = 1.3;

interface Moving {
  sprite: Sprite;
  shadow: Sprite;
  bar: Graphics;
  /** Where it is (map cells), easing toward where the sim says. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  facing: 1 | -1;
  walked: number;
}

export class BattleScene {
  readonly root = new Container();
  /** Everything on the map, scaled and scrolled together. */
  private readonly world = new Container();
  /** Grass beyond the map's sides, where the screen is wider than the map. */
  private readonly backdrop = new Graphics();
  private readonly ground = new Sprite();
  private readonly marks = new Graphics();
  private readonly things = new Container();
  private readonly fx = new Graphics();
  private readonly fxSprites = new Container();
  private mapKey = '';
  private map: BattleMap | null = null;
  vertical = false;
  private scale = 1;
  /** How far along the map the view has scrolled (art px), and where it wants to be. */
  private scroll = 0;
  private draggedAt = -Infinity;
  private width = 0;
  private height = 0;
  private trail = new Set<string>();
  private readonly foes = new Map<number, Moving>();
  private readonly units = new Map<string, Moving>();
  private scenery: SpriteSet | null = null;
  /** The spot the player has picked a fighter for, and which spots are shown as free. */
  selectedPerson: number | null = null;
  aiming: string | null = null;
  private snap: BattleSnap | null = null;
  private style = 'town';

  constructor() {
    this.root.addChild(this.backdrop, this.world);
    this.world.addChild(this.ground, this.marks, this.things, this.fx, this.fxSprites);
    this.things.sortableChildren = true;
    this.root.visible = false;
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** The screen's top and bottom covered by the bars (px): the map fits between them. */
  private top = 0;
  private bottom = 0;

  /** Fit the map to the screen between the bars (the trail along the longer side). */
  resize(w: number, h: number, top = 0, bottom = 0): void {
    if (w === this.width && h === this.height && top === this.top && bottom === this.bottom && this.map) return;
    this.width = w;
    this.height = h;
    this.top = top;
    this.bottom = bottom;
    const vertical = h > w * 1.1;
    if (vertical !== this.vertical) {
      this.vertical = vertical;
      this.mapKey = ''; // (repaint the ground the other way round)
    }
    this.fit();
  }

  private fit(): void {
    if (!this.map) return;
    const across = (this.vertical ? this.width : this.height - this.top - this.bottom) / (this.map.wid * CELL);
    // (snapped to quarter steps, so the art's pixels stay even)
    this.scale = Math.max(0.5, Math.floor(across * 4) / 4);
    this.world.scale.set(this.scale);
    this.place();
  }

  /** The map's length on screen (px), and the screen's length along it. */
  private along(): [number, number] {
    const len = (this.map?.len ?? 0) * CELL * this.scale;
    return [len, this.vertical ? this.height - this.top - this.bottom : this.width];
  }

  private place(): void {
    this.backdrop.clear().rect(0, 0, this.width, this.height).fill(PAL.grass);
    const [len, view] = this.along();
    const max = Math.max(0, len - view);
    this.scroll = Math.max(0, Math.min(max, this.scroll));
    // (centred across, scrolled along)
    const acrossPx = (this.map?.wid ?? 0) * CELL * this.scale;
    const room = this.height - this.top - this.bottom;
    if (this.vertical) this.world.position.set(Math.round((this.width - acrossPx) / 2), this.top + Math.round(len < view ? (view - len) / 2 : -this.scroll));
    else this.world.position.set(Math.round(len < view ? (view - len) / 2 : -this.scroll), this.top + Math.round((room - acrossPx) / 2));
  }

  /** The player drags the map along. */
  dragBy(px: number): void {
    this.scroll -= px;
    this.draggedAt = performance.now();
    this.place();
  }

  /** A screen point to map cells (null off the map). */
  toMap(sx: number, sy: number): [number, number] | null {
    if (!this.map) return null;
    const ax = (sx - this.world.x) / this.scale / CELL;
    const ay = (sy - this.world.y) / this.scale / CELL;
    const [x, y] = this.vertical ? [ay, ax] : [ax, ay];
    return x >= 0 && y >= 0 && x <= this.map.len && y <= this.map.wid ? [x, y] : null;
  }

  /** The spot nearest a screen point (within a cell or so). */
  spotAt(sx: number, sy: number): number | null {
    const at = this.toMap(sx, sy);
    if (!at || !this.map) return null;
    let best: number | null = null;
    let bestD = 1.1;
    for (const q of this.map.spots) {
      const d = Math.hypot(q.x - at[0], q.y - at[1]);
      if (d < bestD && q.kind !== 'tower' && q.kind !== 'trap') {
        bestD = d;
        best = q.id;
      }
    }
    return best;
  }

  /** Where a spot is on the screen (px), or null (for previews and tests: window.__battle). */
  screenOf(spot: number): [number, number] | null {
    const q = this.map?.spots.find((x) => x.id === spot);
    if (!q) return null;
    const [ax, ay] = this.px(q.x, q.y);
    return [this.world.x + ax * this.scale, this.world.y + ay * this.scale];
  }

  /** Where the raider furthest along is on the screen (px), or null (for previews). */
  leadScreen(): [number, number] | null {
    const f = this.snap?.foes.reduce<BattleSnap['foes'][number] | null>((a, c) => (!a || c.x > a.x ? c : a), null);
    if (!f) return null;
    const [ax, ay] = this.px(f.x, f.y);
    return [this.world.x + ax * this.scale, this.world.y + ay * this.scale];
  }

  /** Map cells to the world container's pixels. */
  private px(x: number, y: number): [number, number] {
    return toArt(this.vertical, x, y);
  }

  update(snap: Snapshot, style: string): void {
    const b = snap.battle;
    this.root.visible = !!b;
    this.snap = b;
    if (!b) {
      this.mapKey = '';
      return;
    }
    this.style = style;
    const key = `${b.map.len}|${b.map.wid}|${b.map.paths.length}|${b.map.decor.length}|${b.map.spots.length}|${this.vertical}|${style}|${snap.calendar.season}`;
    if (key !== this.mapKey) this.build(b.map, key, snap);
    this.sync(b, snap);
  }

  /** Paint the map and set out what stands on it. */
  private build(map: BattleMap, key: string, snap: Snapshot): void {
    this.mapKey = key;
    this.map = map;
    this.trail = trailCells(map);
    const seed = map.len * 131 + map.wid * 17 + map.decor.length;
    this.ground.texture = battleGround(map, this.vertical, seed).texture;
    this.scenery ??= makeSpriteSet(0xba77e, noTone);
    for (const c of [...this.things.children]) c.destroy();
    this.foes.clear();
    this.units.clear();
    const taken = new Set(this.trail);
    for (const [x, y] of map.walls) taken.add(`${x},${y}`);
    for (const q of map.spots) taken.add(`${Math.floor(q.x)},${Math.floor(q.y)}`);
    // the town's buildings, along the trail, in its own style
    for (const d of map.decor) {
      const def = BUILDING_BY_ID[d.def];
      if (!def) continue;
      for (let i = 0; i < d.w; i++) taken.add(`${d.x + i},${d.y}`).add(`${d.x + i},${d.y + 1}`);
      const art = buildingArt(d.def, noTone, 'battle', 'ripe', this.style);
      // (sized to its footprint: as wide as it runs along the trail, sideways; two cells across, upright)
      const room = (this.vertical ? 2 : d.w) * CELL;
      const k = Math.min(0.5, room / art.width);
      // (its foot along the front of its footprint: two cells across, `w` along)
      const [fx, fy] = this.vertical ? this.px(d.x + d.w, d.y + 1) : this.px(d.x + d.w / 2, d.y + 2);
      this.figure(art, fx, fy, this.vertical ? Math.min(k, (d.w * CELL) / art.height) : k);
    }
    // the town's towers and traps
    for (const q of map.spots) {
      if (q.kind !== 'tower' && q.kind !== 'trap') continue;
      const tb = snap.buildings.find((x) => x.id === q.building);
      if (!tb) continue;
      const art = buildingArt(tb.def, noTone, 'battle', undefined, this.style);
      const [fx, fy] = this.px(q.x, q.y + 0.5);
      this.figure(art, fx, fy, q.kind === 'trap' ? 0.3 : 0.36);
    }
    // the wild: trees and rocks on the open ground (thicker further from the town)
    const sc = this.scenery;
    const desert = snap.biome === 'desert';
    // (and beyond its sides, where the screen is wider than the map)
    for (let x = 0; x < (map.keep?.from ?? map.len); x++)
      for (let y = map.water ? map.water : -3; y < map.wid + 3; y++) {
        if (taken.has(`${x},${y}`) || this.near(x, y)) continue;
        const r = rand(seed, x, y);
        const wild = 1 - x / map.len; // (the outskirts are wilder)
        if (r > 0.1 + wild * 0.22) continue;
        const pick = rand(seed + 1, x, y);
        const list = map.rock ? sc.boulder : desert ? (pick < 0.7 ? sc.boulder : sc.bush) : pick < 0.45 ? sc.broadleaf : pick < 0.7 ? sc.pine : pick < 0.88 ? sc.bush : sc.boulder;
        const art = list[Math.floor(rand(seed + 2, x, y) * list.length)];
        const [fx, fy] = this.px(x + 0.5, y + 0.9);
        this.figure(art, fx, fy, list === sc.broadleaf || list === sc.pine ? 0.42 : 0.5);
      }
    this.fit();
    // (start where the raiders come in)
    this.scroll = 0;
    this.place();
  }

  /** Whether a cell is right beside the trail (kept clear, so the fighting can be seen). */
  private near(x: number, y: number): boolean {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.trail.has(`${x + dx},${y + dy}`)) return true;
    return false;
  }

  /** A picture standing on the map with its foot at (fx, fy), sorted by how far down the screen it stands. */
  private figure(art: PixelArt, fx: number, fy: number, k: number): Sprite {
    const s = new Sprite(art.texture);
    s.anchor.set(0.5, 1);
    s.scale.set(k);
    s.position.set(Math.round(fx), Math.round(fy));
    s.zIndex = fy;
    this.things.addChild(s);
    return s;
  }

  private moving(): Moving {
    const shadow = new Sprite(glowTexture());
    shadow.anchor.set(0.5);
    shadow.tint = 0x000000;
    shadow.alpha = 0.4;
    const sprite = new Sprite();
    const bar = new Graphics();
    this.things.addChild(shadow, sprite, bar);
    return { sprite, shadow, bar, x: 0, y: 0, tx: 0, ty: 0, facing: 1, walked: 0 };
  }

  private sync(b: BattleSnap, snap: Snapshot): void {
    const map = this.map!;
    const spotOf = new Map(map.spots.map((q) => [q.id, q]));
    // fighters on their spots
    const seenU = new Set<string>();
    for (const u of b.units) {
      const id = u.person !== null ? `p${u.person}` : `a${u.ally}`;
      seenU.add(id);
      const q = spotOf.get(u.spot)!;
      let m = this.units.get(id);
      if (!m) {
        m = this.moving();
        m.x = m.tx = q.x;
        m.y = m.ty = q.y;
        this.units.set(id, m);
      }
      m.tx = q.x;
      m.ty = q.y;
    }
    for (const [id, m] of this.units) if (!seenU.has(id)) this.drop(this.units, id, m);
    // raiders on the trail
    const seenF = new Set<number>();
    for (const f of b.foes) {
      seenF.add(f.id);
      let m = this.foes.get(f.id);
      if (!m) {
        m = this.moving();
        m.x = m.tx = f.x;
        m.y = m.ty = f.y;
        this.foes.set(f.id, m);
      }
      m.tx = f.x;
      m.ty = f.y;
    }
    for (const [id, m] of this.foes) if (!seenF.has(id)) this.drop(this.foes, id, m);
    void snap;
  }

  private drop<K>(list: Map<K, Moving>, id: K, m: Moving): void {
    m.sprite.destroy();
    m.shadow.destroy();
    m.bar.destroy();
    list.delete(id);
  }

  /** Draw a frame: everyone eased toward where they are, posed, with bars, shots and spells; the view follows. */
  render(now: number, dt: number, snap: Snapshot | null): void {
    const b = this.snap;
    if (!b || !snap || !this.map) return;
    const people = new Map<number, PersonView>(snap.people.map((p) => [p.id, p]));
    const raiders = new Map<number, RaiderView>((snap.raid?.raiders ?? []).map((r) => [r.id, r]));
    const ease = Math.min(1, dt * 8);
    // the spots: during placing, rings where fighters can go (bright where the picked fighter may)
    this.marks.clear();
    const placing = b.phase === 'placing' || b.phase === 'breather';
    const picked = this.selectedPerson !== null ? b.roster.find((r) => r.id === this.selectedPerson) : undefined;
    for (const q of this.map.spots) {
      if (q.kind === 'tower' || q.kind === 'trap') continue;
      const [cx, cy] = this.px(q.x, q.y);
      const held = b.units.some((u) => u.spot === q.id);
      const ok = !picked || q.kind === 'block' || q.kind === 'wall' || picked.ranged;
      if (!placing && !held) continue;
      const colour = q.kind === 'block' ? 0xe8c070 : q.kind === 'wall' ? 0x9ad0ff : 0xa8e090;
      const a = placing ? (ok ? (picked ? 0.95 : 0.6) : 0.15) : 0.25;
      if (q.kind === 'block') this.marks.circle(cx, cy, CELL * 0.42).stroke({ width: 1, color: colour, alpha: a });
      else this.marks.rect(cx - CELL * 0.4, cy - CELL * 0.4, CELL * 0.8, CELL * 0.8).stroke({ width: 1, color: colour, alpha: a });
      if (placing && picked && ok && !held) this.marks.circle(cx, cy, CELL * 0.18).fill({ color: colour, alpha: 0.5 + 0.3 * Math.sin(now / 200) });
    }
    // the fighters
    for (const u of b.units) {
      const id = u.person !== null ? `p${u.person}` : `a${u.ally}`;
      const m = this.units.get(id);
      if (!m) continue;
      m.x += (m.tx - m.x) * ease;
      m.y += (m.ty - m.y) * ease;
      const [fx, fy] = this.px(m.x, m.y + 0.35);
      // (they face the nearest raider)
      const near = b.foes.reduce<{ d: number; x: number } | null>((best, f) => {
        const d = Math.hypot(f.x - m.tx, f.y - m.ty);
        return !best || d < best.d ? { d, x: this.px(f.x, f.y)[0] } : best;
      }, null);
      if (near) m.facing = near.x < fx ? -1 : 1;
      const acting = u.sinceAction < 6;
      let hp = 1;
      if (u.person !== null) {
        const p = people.get(u.person);
        if (!p) continue;
        if (p.cls && CLASS_LOOK[p.cls]) {
          // (one who's taken up a class looks the part, as in the town: its Pixel Champions hero)
          const [sheet, block] = CLASS_LOOK[p.cls]!;
          const facing = m.facing < 0 ? 'left' : 'right';
          m.sprite.texture = creatureFrame(sheet, block, facing, acting ? Math.floor(u.sinceAction) : Math.floor(now / 500), acting);
          const size = creatureSize(sheet);
          const flip = creatureFlip(sheet, facing);
          const k = FIGURE * 2;
          m.sprite.scale.set(k * flip, k);
          m.sprite.position.set(Math.round(fx - ((size.w * k) / 2) * flip), Math.round(fy - size.h * k));
        } else {
          const anim: LpcAnim = acting ? (p.gear.weapon && ITEM_BY_ID[p.gear.weapon]?.effects.ranged ? (/st|wd/.test(ITEM_BY_ID[p.gear.weapon].family ?? '') ? 'spell' : 'shoot') : 'slash') : 'walk';
          const frame = acting ? Math.min(FRAME_COUNT[anim] - 1, Math.floor(u.sinceAction * 1.2)) : 0;
          m.sprite.texture = lpcFrame(p.look, anim, frame, heldWeapon(p.gear, 'fight'), wornLayers(p.gear, p.gearQ));
          const k = FIGURE * (p.look.height ?? 1) * (p.growsUpIn !== null ? 0.7 : 1);
          m.sprite.scale.set(k * m.facing, k);
          m.sprite.position.set(Math.round(fx - (m.facing > 0 ? CENTRE_X : -CENTRE_X - 1) * k), Math.round(fy - FEET_Y * k));
        }
        m.sprite.tint = p.rally === 'on' ? 0xffe070 : 0xffffff;
        hp = p.hp / Math.max(1, p.maxHp);
      } else {
        const r = raiders.get(u.ally!);
        if (!r) continue;
        this.pose(m, r, fx, fy, acting, now);
        m.sprite.tint = 0xa8f0b8;
        hp = r.hp / Math.max(1, r.maxHp);
      }
      this.finish(m, fx, fy, hp, 0x8cc05a, false);
    }
    // the raiders
    for (const f of b.foes) {
      const m = this.foes.get(f.id);
      const r = raiders.get(f.id);
      if (!m || !r) continue;
      const step = Math.hypot(m.tx - m.x, m.ty - m.y);
      const [ox] = this.px(m.x, m.y);
      m.x += (m.tx - m.x) * ease;
      m.y += (m.ty - m.y) * ease;
      m.walked += step * ease * CELL;
      const [fx, fy] = this.px(m.x, m.y + 0.3);
      if (Math.abs(fx - ox) > 0.05) m.facing = fx < ox ? -1 : 1;
      this.pose(m, r, fx, fy, f.sinceAction < 6, now);
      m.sprite.tint = r.sinceHit < 3 ? 0xff7070 : (ENEMIES[r.kind]?.tint ?? 0xffffff);
      this.finish(m, fx, fy, r.hp / Math.max(1, r.maxHp), 0xe06040, true);
    }
    // shots in flight, and spells where they were cast
    this.fx.clear();
    for (const s of b.shots) {
      const t = Math.min(1, (s.age + (now % 100) / 1000) * 4);
      if (t >= 1) continue;
      const [ax, ay] = this.px(s.from[0], s.from[1] - 0.6);
      const [bx, by] = this.px(s.to[0], s.to[1] - 0.4);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * (s.kind === 'arrow' ? 6 : 2);
      if (s.kind === 'fire') {
        // a mage's fire: a ball with a tail of sparks, then a burst where it lands
        this.fx.circle(x, y, 2).fill({ color: 0xffb040 }).circle(x, y, 1).fill({ color: 0xfff0a0 });
        for (let k = 1; k <= 3; k++) this.fx.circle(ax + (bx - ax) * (t - k * 0.06), ay + (by - ay) * (t - k * 0.06), 1.4 - k * 0.3).fill({ color: 0xff7020, alpha: 0.6 - k * 0.15 });
        continue;
      }
      const ang = Math.atan2(by - ay, bx - ax);
      const len = s.kind === 'arrow' ? 4 : 5;
      this.fx
        .moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len)
        .lineTo(x, y)
        .stroke({ width: s.kind === 'bolt' ? 1.5 : 1, color: s.kind === 'bolt' ? 0x9ae8ff : s.kind === 'tower' ? 0xf0d080 : 0xe8dcc0 });
    }
    for (const c of this.fxSprites.removeChildren()) c.destroy();
    for (const s of b.shots) {
      if (s.kind !== 'fire' || s.age < 0.25 || s.age > 0.7) continue;
      const [bx, by] = this.px(s.to[0], s.to[1] - 0.4);
      const k = (s.age - 0.25) / 0.45;
      this.fx.circle(bx, by, CELL * MAGE_BURST_DRAWN * (0.3 + 0.7 * k)).fill({ color: 0xff8030, alpha: 0.45 * (1 - k) });
      const tex = blastFrame(k * 12);
      if (tex) this.effect(tex, bx, by, BLAST_SIZE * 0.35);
    }
    for (const c of b.casts) {
      // (each spell in its own colours and effect, as in the town: town/spellLooks.ts)
      const look = LOOKS[c.power];
      const colour = look?.color ?? 0xc080ff;
      const [cx, cy] = this.px(c.x, c.y);
      const k = Math.min(1, c.age / 0.6);
      const r = AIM_RADIUS * CELL;
      this.fx.circle(cx, cy, r * (0.4 + 0.6 * k)).fill({ color: colour, alpha: 0.22 * (1 - c.age / 3) });
      this.fx.circle(cx, cy, r * (0.4 + 0.6 * k)).stroke({ width: 1, color: colour, alpha: 0.7 * (1 - c.age / 3) });
      const sheet = look?.sprite ? SHEETS[look.sprite] : null;
      if (sheet) {
        // (played over the ground it struck: in the middle, and either side)
        const at: [number, number][] = [[0, 0], [-0.45, -0.3], [0.45, 0.3]];
        at.forEach(([dx, dy], i) => {
          const f = sheet.frame((c.age - i * 0.12) * sheet.fps);
          if (!f || c.age < i * 0.12) return;
          const size = sheet.size * (sheet.scale ?? 1) * 0.5;
          this.effect(f, cx + dx * r, cy + dy * r - size * 0.3, size, !!sheet.glow);
        });
      } else {
        const tex = castFrame((c.age + (now % 1000) / 1000) * 8);
        if (tex) this.effect(tex, cx, cy, AREA_SIZE * 0.6, true);
      }
    }
    // the fighters' spells and skills, on the raiders they touched (fight/actLooks.ts: a slash or a spell's effect)
    for (const a of b.acts) {
      const sheet = SHEETS[actSprite(actIdOf(a.name))];
      a.at.forEach((id, i) => {
        const m = this.foes.get(id);
        const t = a.age + ((now % 100) / 1000) - i * 0.08;
        const f = m && t >= 0 ? sheet.frame(t * sheet.fps) : null;
        if (!m || !f) return;
        const [fx, fy] = this.px(m.x, m.y + 0.3);
        const size = sheet.size * (sheet.scale ?? 1) * 0.45;
        this.effect(f, fx, fy - size / 2 + sheet.foot * (sheet.scale ?? 1) * 0.45, size, !!sheet.glow);
      });
    }
    // a hit landing on a fighter (a burst where a raider's blow fell)
    for (const f of b.foes) {
      if (f.hit === null || f.sinceAction > 4) continue;
      const q = this.map.spots.find((s) => s.id === f.hit);
      if (!q) continue;
      const tex = impactFrame(f.sinceAction);
      const [cx, cy] = this.px(q.x, q.y - 0.4);
      if (tex) this.effect(tex, cx, cy, IMPACT_SIZE * 0.4);
    }
    // the aim: a ring where a spell would land
    if (this.aiming && this.lastAim) {
      const [cx, cy] = this.px(this.lastAim[0], this.lastAim[1]);
      this.fx.circle(cx, cy, AIM_RADIUS * CELL).stroke({ width: 1, color: LOOKS[this.aiming]?.color ?? 0xe0b0ff, alpha: 0.8 });
    }
    // follow the raiders furthest along (unless the player has just moved the map)
    if (performance.now() - this.draggedAt > FOLLOW_WAIT_MS && b.foes.length) {
      const lead = Math.max(...b.foes.map((f) => f.x));
      const [len, view] = this.along();
      const want = Math.max(0, Math.min(len - view, lead * CELL * this.scale - view * 0.55));
      this.scroll += (want - this.scroll) * Math.min(1, dt * 2);
      this.place();
    }
  }

  /** Where the player is aiming a spell (map cells), for the ring. */
  lastAim: [number, number] | null = null;

  private effect(tex: Texture, cx: number, cy: number, size: number, glow = true): void {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = size;
    s.position.set(cx, cy);
    s.blendMode = glow ? 'add' : 'normal';
    this.fxSprites.addChild(s);
  }

  /** A raider's (or ally's) picture: a creature sheet, a still, a machine, or a person. */
  private pose(m: Moving, r: RaiderView, fx: number, fy: number, acting: boolean, now: number): void {
    const def = ENEMIES[r.kind];
    const s = m.sprite;
    const facing = m.facing < 0 ? 'left' : 'right';
    const moving = Math.hypot(m.tx - m.x, m.ty - m.y) > 0.02;
    if (!def) return;
    if ('sheet' in def.sprite) {
      const sp = def.sprite as { sheet: CreatureSheet; block: number; scale: number };
      const frame = moving ? Math.floor(m.walked / 3) : Math.floor(now / 200);
      s.texture = creatureFrame(sp.sheet, sp.block, facing, frame, acting, !moving && !acting ? 'idle' : undefined);
      const size = creatureSize(sp.sheet);
      const flip = creatureFlip(sp.sheet, facing);
      const k = sp.scale * FIGURE;
      s.scale.set(k * flip, k);
      s.position.set(Math.round(fx - ((size.w * k) / 2) * flip), Math.round(fy - size.h * k * creatureFeet(sp.sheet)));
    } else if ('still' in def.sprite) {
      const st = def.sprite as StillSprite;
      s.texture = stillTexture(st.still);
      const k = st.scale * FIGURE;
      const flip = m.facing;
      s.scale.set(k * flip, k);
      const bob = st.hover ? Math.round(Math.sin(now / 300 + r.id) * 1) - 3 : 0;
      s.position.set(Math.round(fx - ((s.texture.width * k) / 2) * flip), Math.round(fy - s.texture.height * k + bob));
    } else if ('machine' in def.sprite) {
      const ms = def.sprite as MachineSprite;
      s.texture = machineFrame(ms.machine, acting ? 3 : Math.floor(m.walked / 3));
      const k = ms.scale * FIGURE;
      const size = machineSize(ms.machine);
      s.scale.set(k * m.facing, k);
      s.position.set(Math.round(fx - (size / 2) * k * m.facing), Math.round(fy - size * k));
    } else {
      const hs = def.sprite as HumanSprite;
      const { look, wear } = enemyLook(hs.people, r.id);
      let anim: LpcAnim = 'walk';
      let frame = moving ? 1 + (Math.floor(m.walked / 2) % 8) : 0;
      if (acting) {
        anim = attackAnim(hs, def.ranged);
        frame = Math.min(FRAME_COUNT[anim] - 1, Math.floor(r.sinceAction * (anim === 'shoot' ? 1.6 : 1)));
      }
      s.texture = lpcFrame(look, anim, frame, hs.weapon, wear);
      const k = FIGURE;
      s.scale.set(k * m.facing, k);
      s.position.set(Math.round(fx - (m.facing > 0 ? CENTRE_X : -CENTRE_X - 1) * k), Math.round(fy - FEET_Y * k));
    }
  }

  /** Shadow, depth and a health bar over the head (always, so raiders and the town's own are told apart at a glance:
   * red over raiders, with a red glow at their feet; green over ours). */
  private finish(m: Moving, fx: number, fy: number, hp: number, colour: number, foe: boolean): void {
    m.shadow.position.set(Math.round(fx), Math.round(fy));
    m.shadow.width = foe ? 13 : 10;
    m.shadow.height = foe ? 4 : 3;
    m.shadow.tint = foe ? 0xd02010 : 0x000000;
    m.shadow.alpha = foe ? 0.55 : 0.4;
    m.sprite.zIndex = fy + 0.1;
    m.shadow.zIndex = fy - 0.2;
    const top = Math.min(m.sprite.y, fy - 20) - 3;
    m.bar.clear();
    {
      m.bar
        .rect(Math.round(fx) - 6, Math.round(top), 12, 2)
        .fill({ color: 0x1a120c, alpha: 0.85 })
        .rect(Math.round(fx) - 6, Math.round(top), Math.max(1, Math.round(12 * hp)), 2)
        .fill(colour);
    }
    m.bar.zIndex = 10_000;
  }
}

/** A repeatable random number in [0, 1) for a cell. */
function rand(seed: number, x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export { Text };
