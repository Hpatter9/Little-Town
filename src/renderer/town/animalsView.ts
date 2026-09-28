// Horses at the stables, and the trade caravan (a merchant with pack horses) at the market. Drawn on the
// walkway in front of their buildings. Also the town-wide extras: graves, a haven's ghosts, the launch, meteors.

import { Container, Sprite } from 'pixi.js';
import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import type { Look } from '../../shared/data/people';
import type { Snapshot } from '../../shared/sim/snapshot';
import { CREATURE_FRAME, creatureFrame } from '../art/creatures';
import { CENTRE_X, FEET_Y, lpcFrame } from '../art/lpc/lpc';
import { WALK_Y } from './townView';
import { stillTexture } from '../art/stills';
import { LAUNCH_SIZE, launchFrame, meteorFrame } from '../art/effects';
import { TICK_MS } from '../../shared/sim/time';
import { ROOF_H, ROOM_H } from '../../shared/sim/castle';

const METEOR_SCALE = 1.5;

/** 1024px gravestone art down to ~22px (32 source pixels per art pixel, so it stays crisp). */
const GRAVE_SCALE = 1 / 46;

const MERCHANT: Look = { gender: 'm', skin: '#c9956a', hair: 'shortknot', hairColor: '#3c3434', beard: true, outfit: '#6a3a6a' };
const HORSE_SCALE = 0.85;
/** Bats round a castle at night. */
const BAT_COUNT = 6;

export class AnimalsView {
  private readonly root = new Container();
  private horses: { sprite: Sprite; x: number; dir: 1 | -1; coat: number; phase: number; sheet: 'horse' | 'camel' }[] = [];
  /** Bats round a castle town's keep at night (see castle.ts), and how high it stands. */
  private readonly bats: Sprite[] = [];
  private keepTop: number | null = null;
  private merchant: { sprite: Sprite; x: number } | null = null;
  private key = '';
  /** Gravestones where townsfolk fell (DungeonItemsLite, drawn down to about 22px). */
  private readonly graves = new Container();
  private graveKey = '';
  /** In an undead haven, ghosts drift through the town at night. */
  private readonly ghosts: Sprite[] = [];
  private haunted = false;
  private night = false;
  private campX = 0;
  /** A starburst swirls over the Launch Site as the ship leaves. */
  private readonly launch = new Sprite();
  private launchX: number | null = null;
  /** Meteors striking home: a burst of fire and shrapnel over each building hit. */
  private impacts: { x: number; since: number; at: number }[] = [];
  private readonly bursts: Sprite[] = [];

  constructor(layer: Container) {
    layer.addChild(this.graves, this.root, this.launch); // (the graves sit apart: the horses' redraw clears its own container)
    this.launch.visible = false;
    this.launch.blendMode = 'add'; // (it glows)
  }

  update(s: Snapshot): void {
    this.launchX = s.launchSite;
    this.impacts = s.impacts.map((m) => ({ ...m, at: performance.now() }));
    this.haunted = s.undeadHaven;
    this.night = s.calendar.daylight < 0.4;
    this.campX = (s.tiles.length / 2) * TILE;
    if (!this.ghosts.length) for (let i = 0; i < 4; i++) {
      const g = this.graves.parent!.addChild(new Sprite());
      g.alpha = 0.55;
      g.visible = false;
      this.ghosts.push(g);
    }
    const gk = JSON.stringify(s.graves);
    if (gk !== this.graveKey) {
      this.graveKey = gk;
      this.graves.removeChildren().forEach((c) => c.destroy());
      for (const g of s.graves) {
        const sp = this.graves.addChild(new Sprite(stillTexture('grave')));
        sp.scale.set(GRAVE_SCALE);
        sp.position.set(Math.round(g.x - (1024 * GRAVE_SCALE) / 2), Math.round(WALK_Y - 1024 * GRAVE_SCALE * 0.94));
        sp.alpha = 0.95;
      }
    }
    const stables = s.buildings.filter((b) => b.def === 'stable' && b.status === 'done');
    // (horses ridden into a fight are drawn under their riders instead)
    const ridden = s.people.filter((p) => p.mounted !== null).length;
    const home = s.horses.filter((h) => !h.away).slice(ridden);
    this.keepTop = s.castle ? WALK_Y - 30 - s.castle.floors * ROOM_H - ROOF_H : null;
    const key = JSON.stringify([stables.map((b) => b.tile), home.map((h) => h.coat), s.caravan?.x ?? null, s.biome]);
    if (key === this.key) return;
    this.key = key;
    this.root.removeChildren().forEach((c) => c.destroy());
    this.horses = [];
    this.merchant = null;
    // horses stand in front of their stable, a few per stable
    let i = 0;
    for (const b of stables) {
      const stalls = BUILDING_BY_ID.stable.stalls ?? 4;
      for (let k = 0; k < stalls && i < home.length; k++, i++) {
        const x = b.tile * TILE + 18 + k * ((BUILDING_BY_ID.stable.width * TILE - 36) / Math.max(1, stalls - 1));
        this.addHorse(x, k % 2 ? -1 : 1, home[i].coat);
      }
    }
    if (s.caravan) {
      // (in the desert the caravan comes by camel)
      const camels = s.biome === 'desert';
      this.addHorse(s.caravan.x - 34, 1, camels ? 1 : 3, camels ? 'camel' : 'horse');
      this.addHorse(s.caravan.x - 62, 1, camels ? 0 : 1, camels ? 'camel' : 'horse');
      const sprite = this.root.addChild(new Sprite());
      this.merchant = { sprite, x: s.caravan.x + 14 };
    }
  }

  private addHorse(x: number, dir: 1 | -1, coat: number, sheet: 'horse' | 'camel' = 'horse'): void {
    const sprite = this.root.addChild(new Sprite());
    sprite.scale.set(HORSE_SCALE);
    this.horses.push({ sprite, x, dir, coat, phase: x % 7, sheet });
  }

  render(now: number): void {
    const t = now / 1000;
    const burst = this.launchX !== null ? launchFrame(t * 12) : null;
    this.launch.visible = !!burst;
    if (burst) {
      this.launch.texture = burst;
      this.launch.position.set(Math.round(this.launchX! - LAUNCH_SIZE / 2), WALK_Y - LAUNCH_SIZE + 10); // (as high as the strip allows)
    }
    while (this.bursts.length < this.impacts.length) {
      const sp = this.graves.parent!.addChild(new Sprite());
      sp.scale.set(METEOR_SCALE);
      this.bursts.push(sp);
    }
    this.bursts.forEach((sp, i) => {
      const m = this.impacts[i];
      const f = m ? meteorFrame((m.since + (now - m.at) / TICK_MS) * 0.8) : null;
      sp.visible = !!f;
      if (!f) return;
      sp.texture = f;
      sp.position.set(Math.round(m.x - 48 * METEOR_SCALE), Math.round(WALK_Y - 20 - 56 * METEOR_SCALE)); // (its pivot, over the roof)
    });
    this.ghosts.forEach((g, i) => {
      g.visible = this.haunted && this.night;
      if (!g.visible) return;
      // each drifts back and forth over the town on its own slow loop
      const x = this.campX + Math.sin(t / (9 + i * 3) + i * 2) * (300 + i * 120);
      const dir = Math.cos(t / (9 + i * 3) + i * 2) >= 0 ? 'right' : 'left';
      g.texture = creatureFrame('ghosts', i % 4, dir, Math.floor(t * 4 + i));
      g.position.set(Math.round(x - CREATURE_FRAME / 2), Math.round(WALK_Y - CREATURE_FRAME - 8 + Math.sin(t * 2 + i) * 3));
    });
    // bats wheel round the keep's towers at night
    if (!this.bats.length) for (let i = 0; i < BAT_COUNT; i++) this.bats.push(this.graves.parent!.addChild(new Sprite()));
    this.bats.forEach((b, i) => {
      b.visible = this.keepTop !== null && this.night;
      if (!b.visible) return;
      const a = t * (0.6 + (i % 3) * 0.15) + i * 1.3;
      const x = this.campX + Math.cos(a) * (150 + (i % 4) * 40);
      const y = this.keepTop! + Math.sin(a * 2) * 16 + (i % 3) * 10;
      b.texture = creatureFrame('bats', i % 2 ? 0 : 4, Math.sin(a) > 0 ? 'left' : 'right', Math.floor(t * 8 + i));
      b.scale.set(0.55);
      b.position.set(Math.round(x - 13), Math.round(y));
    });
    for (const h of this.horses) {
      // mostly standing still, now and then shifting a foot
      const frame = Math.floor(now / 900 + h.phase) % 5 === 0 ? 0 : 1;
      h.sprite.texture = creatureFrame(h.sheet, h.coat, h.dir > 0 ? 'right' : 'left', frame);
      h.sprite.x = Math.round(h.x - (CREATURE_FRAME * HORSE_SCALE) / 2);
      h.sprite.y = Math.round(WALK_Y + 2 - CREATURE_FRAME * HORSE_SCALE);
    }
    if (this.merchant) {
      this.merchant.sprite.texture = lpcFrame(MERCHANT, 'walk', 0, null, ['head_hood']);
      this.merchant.sprite.scale.set(-1, 1);
      this.merchant.sprite.x = Math.round(this.merchant.x) + CENTRE_X + 1;
      this.merchant.sprite.y = WALK_Y - FEET_Y;
    }
  }

  /** The caravan under a local walkway x, if any. */
  caravanAt(localX: number, localY: number, s: Snapshot): boolean {
    return !!s.caravan && localX > s.caravan.x - 80 && localX < s.caravan.x + 30 && localY <= WALK_Y && localY >= WALK_Y - 60;
  }
}
