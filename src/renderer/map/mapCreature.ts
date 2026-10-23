// The town's God creature on the map (sim/creature.ts). A kind whose own PixelLab sheets have come
// (art/iso/creature/<kind>/, read by iso/folkLoader.ts `loadCreatureSet`) is drawn from them: upright, facing the way it
// moves (the eight facings), playing the move for what it is doing (iso/creatureRules.ts `creatureMoves`: walking,
// running, at its work, eating, fighting, hurt, asleep, sad, its joy when praised), a person's height times its growth
// (`scale`), and gently tinted by its nature. A kind still without them is drawn like a raider from its stand-in creature
// sheet (data/creature.ts `look`), tinted more strongly (the stand-ins are pale). Either way it walks smoothly between
// the sim's ticks, wears a gold halo when good, and shows a small "?" over its head while a deed waits on praise or a
// scolding. Drawn into the things in world px (the iso view moves it onto the diamonds). Renderer only.

import { ColorMatrixFilter, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { CREATURE_DEFS, type CreatureKind } from '../../shared/data/creature';
import type { CreatureView } from '../../shared/sim/creature';
import { creatureFeet, creatureFlip, creatureFrame, creaturePoseFrames, creatureSize, type CreatureSheet } from '../art/creatures';
import { loadCreatureSet, type SheetSet } from '../iso/folkLoader';
import { creatureMoves, creaturePlay, gentleTint, turnFrame, type CreatureAnim } from '../iso/creatureRules';
import { facingFromVector, type FolkDir } from '../iso/folkRules';
import { markWalker } from '../iso/seeThrough';

/** How fast the drawn creature catches up with where the sim has it (a share of the gap a second). */
const EASE = 6;
/** The sheet's figure is a person's height in its 156px frame, like the folk's: drawn at the folk's scale
 *  (map/mapPeople.ts `FOLK_SCALE`), times its growth. */
const SHEET_SCALE = 0.55;
const SHEET_FRAME = 156;
/** How much of the frame's height the figure stands (for the "?" over its head). */
const SHEET_FIGURE = 0.66;
/** Where its feet are in the frame (a share of its height). */
const SHEET_FEET = 0.82;
/** A death seen on the map lies there this long, then fades over `FADE_S` (seconds). */
const DEAD_SHOW = 8;
const FADE_S = 2;
/** Ticks a second (sim/time.ts), for the snapshot's `praisedAgo`. */
const TICKS_PER_SEC = 10;

export class MapCreature {
  private readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly body = new Sprite();
  /** A gold aura on the ground under a good beast, and its body brightened (a tint only darkens, so goodness shows
   *  as light): both stronger the better it is. */
  private readonly halo = new Graphics();
  private readonly bright = new ColorMatrixFilter();
  private brightAt = -1;
  private readonly mark = new Text({ text: '?', style: { fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold', fill: 0xffe08a, stroke: { color: 0x2a1a08, width: 3 } } });
  private view: CreatureView | null = null;
  private x = 0;
  private y = 0;
  private walked = 0;
  private t = 0;
  private placed = false;
  /** Its own sheets, by kind (null: not drawn yet, so the stand-in), and what's asked for. */
  private sets = new Map<CreatureKind, SheetSet<CreatureAnim> | null>();
  private dir: FolkDir = 'south';
  private speed = 0;
  private turn = '';
  private turnAt = 0;
  private lastHp = -1;
  private wasAsleep = false;
  private hurtAt = -Infinity;
  private wokeAt = -Infinity;
  /** When the map saw it die (its own clock), or -1: only a death seen happening lies on the map a while. */
  private diedAt = -1;
  /** How tall it was last drawn (px), for taps and the "?". */
  private tall = 30;

  constructor(into: Container) {
    this.shadow.ellipse(0, 0, 12, 4).fill({ color: 0x000000, alpha: 0.3 });
    this.mark.anchor.set(0.5, 1);
    this.halo.ellipse(0, 0, 18, 7).fill({ color: 0xffd060, alpha: 0.8 }).ellipse(0, 0, 24, 9.5).stroke({ color: 0xffe9a0, width: 1.5, alpha: 0.7 });
    this.root.addChild(this.shadow, this.halo, this.body, this.mark);
    this.root.visible = false;
    into.addChild(this.root);
    markWalker(this.root); // (the iso view fades what stands in front of it: iso/seeThrough.ts)
  }

  sync(v: CreatureView | null): void {
    const was = this.view;
    // (a death seen as it happens stays to fall; one already old when the map first sees it isn't drawn)
    if (v?.dead && was && !was.dead && this.sheetOf(v.kind)) this.diedAt = this.t;
    const keep = v && !v.fighting && (!v.dead || (this.diedAt >= 0 && this.t - this.diedAt < DEAD_SHOW + FADE_S));
    this.view = keep ? v : null;
    if (!v?.dead) this.diedAt = -1;
    if (this.view && !this.placed) {
      this.x = this.view.x;
      this.y = this.view.y;
      this.placed = true;
      this.lastHp = this.view.hp;
      this.wasAsleep = this.view.asleep;
    }
    if (!this.view) {
      this.placed = false;
      return;
    }
    const cv = this.view;
    if (!cv.dead) {
      if (this.lastHp >= 0 && cv.hp < this.lastHp) this.hurtAt = this.t;
      if (this.wasAsleep && !cv.asleep) this.wokeAt = this.t;
    }
    this.lastHp = cv.hp;
    this.wasAsleep = cv.asleep;
  }

  /** Its kind's own sheets if they're here, asking for them the first time (null while missing or loading). */
  private sheetOf(kind: CreatureKind): SheetSet<CreatureAnim> | null {
    if (!this.sets.has(kind)) {
      this.sets.set(kind, null);
      void loadCreatureSet<CreatureAnim>(kind).then((s) => this.sets.set(kind, s));
    }
    return this.sets.get(kind) ?? null;
  }

  render(dt: number): void {
    const v = this.view;
    this.root.visible = !!v;
    if (!v) return;
    this.t += dt;
    const k = Math.min(1, dt * EASE);
    const nx = this.x + (v.x - this.x) * k;
    const ny = this.y + (v.y - this.y) * k;
    const step = Math.hypot(nx - this.x, ny - this.y);
    this.walked += step;
    const f = facingFromVector(nx - this.x, ny - this.y);
    if (f && step > 0.05) this.dir = f;
    if (dt > 0) this.speed += (step / dt - this.speed) * Math.min(1, dt / 0.25);
    this.x = nx;
    this.y = ny;
    const set = this.sheetOf(v.kind);
    const good = Math.max(0, (v.align - 10) / 90);
    const tall = (this.tall = set ? this.drawSheet(v, set) : this.drawStandIn(v, step));
    this.halo.visible = good > 0;
    this.halo.alpha = Math.min(1, good * 1.3) * (0.8 + 0.2 * Math.sin(this.t * 2));
    this.halo.scale.set(v.scale);
    // (the stand-in brightened by steps of a tenth, so the filter is set again only when it changes; never its own
    // sheet: the filter blotched its frames black in the browser, and the warm tint and the halo show its goodness)
    const lift = set ? 0 : Math.round(good * 10) / 10;
    if (lift !== this.brightAt) {
      this.brightAt = lift;
      this.bright.brightness(1 + lift, false);
      this.body.filters = lift > 0 ? [this.bright] : [];
    }
    this.shadow.scale.set(v.scale * (set ? 1.4 : 1));
    this.mark.visible = !!v.ask && !v.dead;
    this.mark.position.set(0, -tall - 4 + Math.sin(this.t * 4) * 2);
    // (a death lies a while, then fades)
    this.root.alpha = this.diedAt >= 0 ? Math.max(0, Math.min(1, 1 - (this.t - this.diedAt - DEAD_SHOW) / FADE_S)) : 1;
    // (in world px: the iso view's `placeLoose` moves it onto the diamonds and sorts it among the buildings)
    this.root.position.set(Math.round(this.x), Math.round(this.y + 4));
    this.root.zIndex = Math.round(this.y);
  }

  /** From its own sheets: the move for what it's doing, its facing and frame. Returns how tall it stands (px). */
  private drawSheet(v: CreatureView, set: SheetSet<CreatureAnim>): number {
    const moves = creatureMoves(v, {
      speed: this.speed,
      sinceHurt: this.t - this.hurtAt,
      sincePraised: v.praisedAgo !== undefined ? v.praisedAgo / TICKS_PER_SEC : Infinity,
      sinceWoke: this.t - this.wokeAt,
    });
    const plays = moves.map((m) => creaturePlay(m, (a) => set.has(a)));
    const key = plays.map((p) => p.anim).join('+');
    if (key !== this.turn) {
      this.turn = key;
      this.turnAt = this.t;
    }
    const { i, frame } = turnFrame((j) => set.count(plays[j].anim), plays.map((p) => p.fps * p.rate), plays.length, this.t - this.turnAt, plays.length > 1 || plays[0].loop);
    const tex: Texture | null = set.texture(plays[i].anim, this.dir, frame) ?? set.texture('stand', this.dir, 0);
    this.body.visible = !!tex;
    if (tex) this.body.texture = tex;
    const scale = SHEET_SCALE * v.scale;
    // (the figure's feet are some way up from the frame's foot (128 of 156): anchored there, on its shadow)
    this.body.anchor.set(0.5, SHEET_FEET);
    this.body.scale.set(scale);
    this.body.tint = gentleTint(v.tint, v.align);
    return SHEET_FRAME * SHEET_FIGURE * scale;
  }

  /** The stand-in from a creature sheet (a kind with no sheets of its own yet). Returns how tall it stands (px). */
  private drawStandIn(v: CreatureView, step: number): number {
    const look = CREATURE_DEFS[v.kind].look;
    const sheet = look.sheet as CreatureSheet;
    const facing = v.dir < 0 ? 'left' : 'right';
    const moving = step > 0.05 && !v.asleep;
    const idle = creaturePoseFrames(sheet, 'idle') > 0 && !moving;
    const frame = moving ? Math.floor(this.walked / 7) : v.asleep ? 0 : Math.floor(this.t * 2);
    this.body.visible = true;
    this.body.texture = creatureFrame(sheet, look.block, facing, frame, false, idle ? 'idle' : undefined);
    const scale = look.scale * v.scale;
    this.body.anchor.set(0.5, creatureFeet(sheet));
    this.body.scale.set(scale * creatureFlip(sheet, facing), scale * (v.asleep ? 0.85 : 1));
    this.body.tint = v.tint;
    return creatureSize(sheet).h * scale * 0.8;
  }

  /** Where it stands (world px), or null. */
  posOf(): { x: number; y: number } | null {
    return this.view && !this.view.dead ? { x: this.x, y: this.y } : null;
  }

  /** Whether a world point is on it (generous: it's big, and fingers are blunt). */
  at(wx: number, wy: number): boolean {
    const v = this.view;
    if (!v || v.dead) return false;
    const r = Math.max(18 * v.scale, this.tall * 0.45);
    return Math.abs(wx - this.x) < r && wy > this.y - Math.max(r * 1.4, this.tall) && wy < this.y + r * 0.8;
  }
}
