// One townsperson on the isometric map: a Pixi sprite that shows the right frame for what the snapshot says they're
// doing, anchored at the feet. Call `update` once a frame with their PersonView, the map position's screen spot and
// the time; it does the facing, the animation, the look (armed or bare, loaded when first needed) and the frame.
// The sprite never touches the game state.

import { Container, Sprite, type Texture } from 'pixi.js';
import { ITEM_BY_ID } from '../../shared/data/items';
import { loadFolkSet, type FolkSet } from './folkLoader';
import {
  armedSuffix, dressOf, facingFromVector, frameAt, isFighting, lookPath, pickLook, play, wantedAnim, type FolkDir, type FolkPlay, type FolkState,
} from './folkRules';
import { variantOf } from './folkTint';

/** The Moon Pack's wolf-headed look, worn in the werewolf's form (not in FOLK_LOOKS: never an everyday pick). */
const WOLF_LOOK = 'man_beast';

/** A person standing still this long (seconds) is idle rather than held mid-stride. */
const SEEN_FOR = 0.25;

export class FolkSprite extends Container {
  private sprite = new Sprite();
  private dir: FolkDir = 'south';
  private lastX = NaN;
  private lastY = NaN;
  private speed = 0;
  private anim = '';
  private startedAt = 0;
  private path = '';
  private want = '';
  private set: FolkSet | null = null;
  /** The bare look, kept so an armed look not drawn yet (or still loading) can stand in. */
  private bare: FolkSet | null = null;

  constructor() {
    super();
    this.sprite.anchor.set(0.5, 1);
    this.addChild(this.sprite);
  }

  /**
   * @param st    the person's snapshot (a PersonView fits)
   * @param mapX  where they are on the map (the top-down x, y), for facing and speed
   * @param mapY
   * @param now   seconds, any steady clock
   * @param dt    seconds since the last frame
   * @param face  an optional map spot to face while working or fighting (a target); else they face the way they last moved
   * @param wolf  a werewolf in its form: wears the Moon Pack's `man_beast` (bare, same tint as their human look)
   */
  update(st: FolkState, mapX: number, mapY: number, now: number, dt: number, face?: { x: number; y: number }, wolf = false): void {
    // how they're moving: facing and speed (smoothed a little, so a stop-start step doesn't flicker walk/idle)
    if (!Number.isNaN(this.lastX) && dt > 0) {
      const dx = mapX - this.lastX, dy = mapY - this.lastY;
      const f = facingFromVector(dx, dy);
      if (f) this.dir = f;
      const inst = Math.hypot(dx, dy) / dt;
      this.speed += (inst - this.speed) * Math.min(1, dt / SEEN_FOR);
    }
    this.lastX = mapX;
    this.lastY = mapY;
    if (face && this.speed < 1) {
      const f = facingFromVector(face.x - mapX, face.y - mapY);
      if (f) this.dir = f;
    }

    const weapon = st.gear.weapon ? ITEM_BY_ID[st.gear.weapon] : undefined;
    const family = weapon?.family;
    const suffix = wolf ? null : armedSuffix(st, family, isFighting(st));
    const body = st.gear.body ? ITEM_BY_ID[st.gear.body] : undefined;
    const pick = wolf ? { people: 'werewolf', look: WOLF_LOOK } : pickLook(st, undefined, dressOf(body?.weight));
    const bare = lookPath(pick, null);
    const wanted = lookPath(pick, suffix);
    const variant = variantOf(st.id);
    this.ensure(bare, wanted, variant);

    // an armed look that isn't here (yet) is the bare one
    const set = this.set ?? this.bare;
    if (!set) {
      this.sprite.visible = false;
      return;
    }
    const want = wantedAnim(st, this.speed, family);
    const p: FolkPlay & { rate: number } = play(want, (a) => set.has(a));
    // (a look with no death drawn yet lies its standing figure down rather than standing over its own fall)
    this.sprite.rotation = want === 'death' && p.anim !== 'death' && p.anim !== 'hurt' ? -Math.PI / 2 : 0;
    const key = `${this.path}|${p.anim}`;
    if (key !== this.anim) {
      this.anim = key;
      this.startedAt = now;
    }
    const n = frameAt(set.count(p.anim), p.fps * p.rate, now - this.startedAt, p.loop);
    const tex: Texture | null = set.texture(p.anim, this.dir, n) ?? set.texture('stand', this.dir, 0);
    this.sprite.visible = !!tex;
    if (tex) this.sprite.texture = tex;
  }

  /** Start loading a look (bare and armed) the first time it's asked for, and take it up when it arrives. */
  private ensure(bare: string, wanted: string, variant: number): void {
    const tag = `${wanted}#${variant}`;
    if (tag === this.want) return;
    this.want = tag;
    this.path = wanted;
    this.set = null;
    void loadFolkSet(bare, variant).then((s) => {
      if (this.destroyed) return;
      this.bare = s;
    });
    if (wanted === bare) {
      void loadFolkSet(bare, variant).then((s) => {
        if (!this.destroyed && this.want === tag) this.set = s;
      });
    } else {
      void loadFolkSet(wanted, variant).then((s) => {
        if (!this.destroyed && this.want === tag) this.set = s; // (null: stays on the bare look)
      });
    }
  }
}
