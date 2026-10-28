// One townsperson on the isometric map: a Pixi sprite that shows the right frame for what the snapshot says they're
// doing, anchored at the feet (folkRules `feetAnchor`). Call `update` once a frame with their PersonView, the map position's screen spot and
// the time; it does the facing, the animation, the look (armed or bare, loaded when first needed) and the frame.
// The sprite never touches the game state.

import { Container, Sprite, type Texture } from 'pixi.js';
import { ITEM_BY_ID } from '../../shared/data/items';
import { emoteFrame, EMOTE_SIZE } from '../art/effects';
import { loadFolkSet, type FolkSet } from './folkLoader';
import {
  CHILD_SCALE, feetAnchor, armedSuffix, breathAt, sleepDir, sleepsOut, facingFromVector, otherTool, frameAt, isFighting, lookPath, play, wantedAnim, type FolkAnim, type FolkDir, type FolkPlay, type FolkState,
} from './folkRules';
import { tintKey, type FolkTint } from './folkTint';
import { folkWho } from './folkWho';

/** The Moon Pack's wolf-headed look, worn in the werewolf's form (not in FOLK_LOOKS: never an everyday pick). */
const WOLF_LOOK = 'man_beast';

/** A person standing still this long (seconds) is idle rather than held mid-stride. */
const SEEN_FOR = 0.25;

export class FolkSprite extends Container {
  private sprite = new Sprite();
  /** The "z"s over someone asleep out of doors (5000 Pixel Effects' zzz, the emote the map shows over a sleeper). */
  private zzz: Sprite | null = null;
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
   * @param wolf  a werewolf in its form: wears the Moon Pack's `man_beast` (bare, in its own colours)
   * @param board on the raid board: the animation and facing the board gives them (iso/boardRules.ts), armed all fight
   */
  update(st: FolkState, mapX: number, mapY: number, now: number, dt: number, face?: { x: number; y: number }, wolf = false, board?: { anim: FolkAnim; dir: FolkDir }): void {
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
    if (board) this.dir = board.dir;
    else if (face && this.speed < 1) {
      const f = facingFromVector(face.x - mapX, face.y - mapY);
      if (f) this.dir = f;
    }

    const weapon = st.gear.weapon ? ITEM_BY_ID[st.gear.weapon] : undefined;
    const family = weapon?.family;
    const who = folkWho(st);
    // (a child has no armed looks and no wolf form: they keep their own look, whatever they're about)
    const turned = wolf && !who.child;
    const suffix = turned || who.child ? null : armedSuffix(st, family, !!board || isFighting(st));
    const pick = turned ? { people: 'werewolf', look: WOLF_LOOK } : who.pick;
    const bare = lookPath(pick, null);
    const wanted = lookPath(pick, suffix);
    // (the same colours on the bare and the armed looks; the wolf form is the Moon Pack's own, never recoloured)
    const tint = turned ? null : who.tint;
    const alt = otherTool(suffix);
    this.sprite.scale.set(who.child ? CHILD_SCALE : 1);
    this.ensure(bare, wanted, tint, alt ? lookPath(pick, alt) : null);

    // an armed look that isn't here (yet) is the bare one; and the armed looks are drawn with their one move only (a
    // swing, a shot, a cast), so for everything else (walking, flinching, falling) the bare look's own sheets play
    const want = board?.anim ?? wantedAnim(st, this.speed, family);
    const held = this.set && this.set !== this.bare ? this.set : null;
    const armedPlays = held ? play(want, (a) => held.has(a)).anim : 'stand';
    const armed = armedPlays !== 'stand' && armedPlays !== 'idle' ? held : null;
    const set = armed ?? this.bare ?? this.set;
    if (!set) {
      this.sprite.visible = false;
      return;
    }
    // (anchored at the feet, which stand some way up the padded frame, so they're on the spot and on their shadow;
    // a child's art stands higher in its frame than the grown looks')
    this.sprite.anchor.set(0.5, feetAnchor(set.index.frame[1], who.child && !turned));
    // asleep on the ground: their look's fall held at its end, lying still and breathing, the z's rising over them
    if (sleepsOut(st, this.speed) && !board && set.has('death')) {
      this.sleep(set, st.id, now);
      return;
    }
    if (this.zzz) this.zzz.visible = false;
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

  /** Lying asleep: the death sheet's last frame (it ends lying flat) in one of the calm facings, breathing. */
  private sleep(set: FolkSet, id: number, now: number): void {
    const tex = set.texture('death', sleepDir(id), set.count('death') - 1);
    this.sprite.visible = !!tex;
    if (tex) this.sprite.texture = tex;
    this.sprite.rotation = 0;
    this.anim = '';
    const k = Math.abs(this.sprite.scale.x);
    this.sprite.scale.y = k * breathAt(now, id).sy;
    const f = emoteFrame('zzz', now * 7 + id);
    if (f && !this.zzz) this.zzz = this.addChild(new Sprite());
    if (this.zzz) {
      this.zzz.visible = !!f;
      if (f) {
        this.zzz.texture = f;
        this.zzz.anchor.set(0.5, 1);
        this.zzz.scale.set(1.2);
        this.zzz.alpha = 0.85;
        // (over the sleeper's head, which lies about a figure's width up from their feet, and bobbing a little)
        this.zzz.position.set(14 + EMOTE_SIZE * 0.2, -46 * k + Math.sin(now * 1.6 + id) * 2);
      }
    }
  }

  /** Start loading a look (bare and armed) the first time it's asked for, and take it up when it arrives. */
  private ensure(bare: string, wanted: string, tint: FolkTint | null, instead: string | null = null): void {
    const tag = `${wanted}#${tintKey(tint)}`;
    if (tag === this.want) return;
    this.want = tag;
    this.path = wanted;
    this.set = null;
    void loadFolkSet(bare, tint).then((s) => {
      if (this.destroyed) return;
      this.bare = s;
    });
    if (wanted === bare) {
      void loadFolkSet(bare, tint).then((s) => {
        if (!this.destroyed && this.want === tag) this.set = s;
      });
    } else {
      // (null: the look's other tool if it has one, else it stays on the bare look)
      void loadFolkSet(wanted, tint)
        .then((s) => s ?? (instead ? loadFolkSet(instead, tint) : null))
        .then((s) => {
          if (!this.destroyed && this.want === tag) this.set = s;
        });
    }
  }
}
