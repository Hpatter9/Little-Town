// The raid board's units in their own looks (the owner's call: "no switching sprites, they need to be consistent"):
// which animation a townsperson's PixelLab look or the God creature's sheet plays for what the board says they're
// doing, and which way they face. No Pixi and no DOM, so the tests can run it. Drawn by map/mapPeople.ts and
// map/mapRaiders.ts for tactics/tacticsView.ts.

import type { CreatureAnim } from './creatureRules';
import { armedKind, BLOW_TICKS, HURT_TICKS, type FolkAnim, type FolkDir, type FolkState } from './folkRules';

/** A board unit's grid facing (sim/tactics.ts `TacUnit.facing`: 0 +u, 1 +v, 2 -u, 3 -v) as a facing on screen: the
 *  board's +u runs down to the right, +v down to the left. The sim turns a unit to each tile it steps onto and to
 *  whatever it strikes, so this is "facing their target or move". */
export const BOARD_FACING: readonly FolkDir[] = ['south-east', 'south-west', 'north-west', 'north-east'];
export const boardFacing = (facing: number): FolkDir => BOARD_FACING[((Math.round(facing) % 4) + 4) % 4];

/** What the board says of a unit's turn (tactics/tacticsView.ts, from the snapshot's `act`). */
export interface BoardMoment {
  /** Walking its path this turn. */
  moving: boolean;
  /** Its act this turn is a spell or skill (a cast), not a blow or a shot. */
  casting: boolean;
}

/** A God creature's blow, hurt and miracle show this long (ticks), as a raider's blow does on the map. */
export const STRIKE_TICKS = 8;

/** The animation a townsperson's look plays on the board: dying when down, a flinch when just hit, their weapon's
 *  blow (a cast for a spell) when they've just acted, the walk on their move, else standing ready. (On the map a
 *  defender swings on and off all raid long; the board's turns are slower, so a blow shows only when one lands.) */
export function boardFolkAnim(st: Pick<FolkState, 'downed' | 'hp' | 'sinceHit' | 'sinceBlow'>, m: BoardMoment, family: string | undefined): FolkAnim {
  if (st.downed !== null || st.hp <= 0) return 'death';
  if (st.sinceHit < HURT_TICKS) return 'hurt';
  const k = armedKind(family);
  if (st.sinceBlow < BLOW_TICKS) {
    if (m.casting) return k === 'staff' ? 'cast_2h' : 'cast_1h';
    if (k === 'bow') return 'attack_bow';
    if (k === 'staff') return 'cast_2h';
    if (k === 'greatsword') return 'attack_2h';
    return 'attack_1h';
  }
  if (m.moving) return 'walk';
  return 'idle';
}

/** The God creature's moves on the board (played in turn, as on the map: iso/creatureRules.ts `turnFrame`): dying
 *  when down, `hit` when just struck, a punch or an uppercut by turns for a blow (`blows`: how many it has struck, so
 *  each blow is the other), the miracle for a spell, the walk on its move, else idle. */
export function boardCreatureMoves(r: { down: boolean; sinceHit: number; sinceAction: number }, m: BoardMoment, blows: number): CreatureAnim[] {
  if (r.down) return ['death'];
  if (r.sinceHit < HURT_TICKS) return ['hit'];
  if (r.sinceAction < STRIKE_TICKS) return m.casting ? ['miracle'] : [blows % 2 ? 'uppercut' : 'punch'];
  if (m.moving) return ['walk'];
  return ['idle'];
}
