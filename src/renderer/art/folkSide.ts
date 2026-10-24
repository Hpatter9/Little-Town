// The townsfolk side-on, in their isometric look: the same PixelLab look and colours the map and the menus give them
// (iso/folkWho.ts), turned east or west, for the side-on screens (the fight screen, the trip pane, cutscenes, the Deep,
// the mine, the Underdark). Before this those screens drew the old Himeko paper doll. A look loads by URL the first
// time it is asked for; until it is in, `folkSide` says false and the caller draws the paper doll meanwhile.

import type { Sprite } from 'pixi.js';
import type { OriginId } from '../../shared/data/origins';
import type { Look } from '../../shared/data/people';
import type { Slot } from '../../shared/data/items';
import { ITEM_BY_ID } from '../../shared/data/items';
import { loadFolkSet, type FolkSet } from '../iso/folkLoader';
import { CHILD_SCALE, armedKind, frameAt, lookPath, play, type FolkAnim } from '../iso/folkRules';
import { tintKey } from '../iso/folkTint';
import { folkWho } from '../iso/folkWho';
import { folkWhoById, type PortraitWho } from './folkPortrait';

/** Where the feet stand in a look's frame (as a share of its height) and how tall a grown figure is in it: measured
 *  across the peoples' looks (feet about 0.81 down, the figure about 0.62 of the frame). */
const FEET = 0.815;
const FIGURE = 0.62;
/** The Moon Pack's wolf-headed look, worn in the werewolf's form (as iso/folkSprite.ts `WOLF_LOOK`). */
const WOLF_LOOK = 'man_beast';

/** What a side-on screen knows of the moment: the same things it gave the paper doll's `hkPose`. */
export interface SidePose {
  faceLeft: boolean;
  /** A top-down screen's four ways (the Deep, the Underdark): up and down turn them away or toward us. */
  facing?: 'left' | 'right' | 'up' | 'down';
  moving?: boolean;
  /** Working (a pick or a hammer swung). */
  working?: boolean;
  /** Ticks since their last blow (under 6: striking), and since they were hit (under 3: flinching). */
  sinceBlow?: number;
  sinceHit?: number;
  down?: boolean;
  ranged?: boolean;
  /** Casting a spell (a cutscene's `cast`). */
  casting?: boolean;
  /** A werewolf in their wolf form: the Moon Pack's wolf-headed look (`man_beast`), as the map draws them. */
  wolf?: boolean;
  /** Milliseconds, any steady clock (the animation's frame). */
  now: number;
}

const sets = new Map<string, FolkSet | null>();
const asked = new Set<string>();

/** A look's set if it is in (null while it loads, or for ever if the look isn't drawn), starting it the first time. */
function setOf(path: string, w: ReturnType<typeof folkWho>): FolkSet | null {
  const key = `${path}#${tintKey(w.tint)}`;
  if (!asked.has(key)) {
    asked.add(key);
    void loadFolkSet(path, w.tint).then((s) => sets.set(key, s));
  }
  return sets.get(key) ?? null;
}

/** The animation for a side-on pose. */
function animOf(p: SidePose, family: string | undefined): FolkAnim {
  if (p.down) return 'death';
  if ((p.sinceHit ?? 99) < 3) return 'hurt';
  if (p.casting) return 'cast_1h';
  if ((p.sinceBlow ?? 99) < 6) {
    const k = armedKind(family);
    if (p.ranged || k === 'bow') return 'attack_bow';
    if (k === 'staff') return 'cast_2h';
    if (k === 'greatsword') return 'attack_2h';
    return 'attack_1h';
  }
  if (p.working) return 'hammer';
  if (p.moving) return 'walk';
  return 'idle';
}

/** Set a sprite to someone's look side-on, feet at (x, feetY), a grown figure `height` tall (a child stands shorter).
 *  False while the look loads (the caller draws the paper doll meanwhile). */
export function folkSide(s: Sprite, who: PortraitWho, p: SidePose, x: number, feetY: number, height: number): boolean {
  const own = folkWho(who);
  // (the wolf form is the Moon Pack's own look, never recoloured, and bare-handed: iso/folkSprite.ts)
  const turned = !!p.wolf && !own.child;
  const w = turned ? { ...own, pick: { people: 'werewolf', look: WOLF_LOOK }, tint: null, path: `werewolf/${WOLF_LOOK}` } : own;
  const family = turned ? undefined : who.gear.weapon ? ITEM_BY_ID[who.gear.weapon]?.family : undefined;
  const want = animOf(p, family);
  // (the armed look for a blow or a swing, where the look has one: else the bare look's own move)
  const suffix = w.child ? null : want === 'hammer' ? 'hammer' : want.startsWith('attack') || want === 'cast_2h' ? (armedKind(family) ?? null) : null;
  const bare = setOf(w.path, w);
  const armed = suffix ? setOf(lookPath(w.pick, suffix), w) : null;
  const set = armed ?? bare;
  if (!set) return false;
  const pl = play(want, (a) => set.has(a));
  // (a fall: played once from when they went down; the rest loop on the clock)
  const n = frameAt(set.count(pl.anim), pl.fps * pl.rate, p.now / 1000, pl.loop && !p.down);
  const dir = p.facing === 'up' ? 'north' : p.facing === 'down' ? 'south' : p.faceLeft || p.facing === 'left' ? 'west' : 'east';
  const tex = set.texture(pl.anim, dir, p.down ? set.count(pl.anim) - 1 : n) ?? set.texture('stand', dir, 0);
  if (!tex) return false;
  s.texture = tex;
  // (a look with no fall drawn lies its standing figure down, as on the map)
  s.rotation = want === 'death' && pl.anim !== 'death' && pl.anim !== 'hurt' ? (p.faceLeft ? Math.PI / 2 : -Math.PI / 2) : 0;
  s.anchor.set(0.5, FEET);
  const k = (height / (set.index.frame[1] * FIGURE)) * (w.child ? CHILD_SCALE : 1);
  s.scale.set(k, k);
  s.position.set(Math.round(x), Math.round(feetY));
  return true;
}

/** `folkSide` for someone known by id (a party member, a fighter): the look the map gives them. */
export function folkSideById(s: Sprite, id: number, look: Look, gear: Partial<Record<Slot, string>> | undefined, p: SidePose, x: number, feetY: number, height: number, origin?: OriginId): boolean {
  return folkSide(s, folkWhoById(id, look, gear, origin), p, x, feetY, height);
}
