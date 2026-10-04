// How townsfolk fight on screen: the LPC blow for their weapon's family (a sword's swing, a spear's thrust, a bow
// drawn, a staff's cast), a flinch when struck and the fallen lying still; and for the fighting callings, a combat
// form from the Craftpix hero packs (knights, samurai, ninja, wizards: tools/compose-sheets.cjs) taken up while they
// fight, with its own attacks, guard, hurt and dying frames. Shared by the map (map/mapPeople.ts) and the Final
// Fantasy fight screen (fight/fightView.ts).

import type { ClassId } from '../../shared/data/classes';
import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import type { PackSheetId } from '../../shared/data/packSheets';
import { PACK_SHEETS } from '../../shared/data/packSheets';
import type { FamilyId } from '../../shared/data/weapons';
import { creatureFrame, creaturePoseFrames, type CreaturePose } from './creatures';
import { FRAME_COUNT, type LpcAnim } from './lpc/lpc';
import type { Texture } from 'pixi.js';

/** The LPC row each weapon family strikes with (none listed: a sword's swing). */
const ANIM_BY_FAMILY: Partial<Record<FamilyId, LpcAnim>> = {
  sp: 'thrust',
  pl: 'thrust',
  dg: 'thrust',
  bw: 'shoot',
  lb: 'shoot',
  cb: 'shoot',
  sl: 'shoot',
  th: 'shoot',
  pi: 'shoot',
  lg: 'shoot',
  sg: 'shoot',
  ag: 'shoot',
  en: 'shoot',
  st: 'spell',
  wd: 'spell',
};
/** The LPC blow for someone's weapon (`ranged`: they fight from range by their calling, so a cast when no weapon
 *  says otherwise; bare hands thrust). */
export function fightAnim(gear: Partial<Record<Slot, string>>, ranged = false): LpcAnim {
  const w = gear.weapon ? ITEM_BY_ID[gear.weapon] : undefined;
  if (w?.family && ANIM_BY_FAMILY[w.family]) return ANIM_BY_FAMILY[w.family]!;
  if (w?.effects?.ranged) return 'shoot';
  if (ranged) return 'spell';
  return w ? 'slash' : 'thrust';
}
/** How many ticks an LPC blow takes to play (the bow is slower to draw). */
export const BLOW_TICKS = 8;
export const SHOOT_TICKS = 13;

/** The LPC frame for someone fighting: a blow when they've just struck, a flinch when just hit, lying when down,
 *  else standing ready. */
export function fightPose(st: { sinceBlow: number; sinceHit: number; down: boolean }, anim: LpcAnim): [LpcAnim, number] {
  if (st.down) return ['hurt', FRAME_COUNT.hurt - 1];
  if (st.sinceHit < 3) return ['hurt', st.sinceHit < 2 ? 0 : 1];
  const span = anim === 'shoot' ? SHOOT_TICKS : BLOW_TICKS;
  if (st.sinceBlow < span) return [anim, Math.min(FRAME_COUNT[anim] - 1, Math.floor((st.sinceBlow / span) * FRAME_COUNT[anim]))];
  return ['walk', 0];
}

/** The hero packs' sheets for the fighting callings (a line's sheet; several: picked by the person's id). */
export const HERO_FORM: Partial<Record<ClassId, PackSheetId[]>> = {
  knight: ['knight_1', 'knight_2', 'knight_3'],
  guardian: ['knight_2', 'knight_3'],
  warrior: ['samurai_commander'],
  dragoon: ['samurai_commander'],
  samurai: ['samurai'],
  spellblade: ['samurai'],
  archer: ['samurai_archer'],
  ranger: ['samurai_archer'],
  hunter: ['samurai_archer'],
  monk: ['ninja_monk'],
  assassin: ['kunoichi'],
  dancer: ['kunoichi'],
  witch: ['fire_wizard'],
  shaman: ['wanderer_mage'],
  chronomancer: ['lightning_mage'],
};
/** The combat form of someone of this calling (none: they fight as themselves). */
export function heroSheet(cls: ClassId | null, id: number): PackSheetId | null {
  const list = cls ? HERO_FORM[cls] : undefined;
  return list ? list[id % list.length] : null;
}
/** A founder's form, worn always (the owner's ask: the founders stand out as special everywhere): their calling's
 *  hero, else one by how they fight (a shooter the archer, a caster a wizard, the rest the samurai). */
export function founderSheet(cls: ClassId | null, id: number, ranged: boolean, caster: boolean): PackSheetId {
  return heroSheet(cls, id) ?? (caster ? (['fire_wizard', 'wanderer_mage', 'lightning_mage'] as PackSheetId[])[id % 3] : ranged ? 'samurai_archer' : 'samurai');
}
/** How tall a hero stands on screen (px, before the person's own scale): about an LPC townsperson's figure. */
export const HERO_HEIGHT = 50;
/** The scale that brings a hero sheet's figure to HERO_HEIGHT. */
export const heroScale = (sheet: PackSheetId) => HERO_HEIGHT / PACK_SHEETS[sheet];

/** A werewolf's shape (Craftpix's werewolf sheets: black, red or white by who they are), on the map under the full
 *  moon and whenever they fight, and on the fight screen; and how much bigger than a person they stand. */
export const WOLF_FORMS: PackSheetId[] = ['werewolf_black', 'werewolf_red', 'werewolf_white'];
export const WOLF_SCALE = 1.2;

/** The raised dead's shape in a fight (Craftpix's skeleton sheets): an archer for a shooter, else a warrior or a
 *  spearman by who they are. */
export const skeletonSheet = (ranged: boolean, id: number): PackSheetId => (ranged ? 'skeleton_archer' : id % 2 ? 'skeleton_spearman' : 'skeleton_warrior');

export interface HeroState {
  facing: 'left' | 'right';
  /** Walking, and how far they've walked (px) for the stride. */
  moving: boolean;
  walked: number;
  sinceBlow: number;
  sinceHit: number;
  sinceBlock: number;
  down: boolean;
  /** For the idle breathing (ms) and to offset one hero from the next. */
  now: number;
  ref: number;
}
/** How long a hero's blow, flinch and guard show (ticks). */
const HERO_BLOW = 8;
const HERO_HURT = 5;
const HERO_GUARD = 10;

/** The hero sheet's frame for someone's state: dying when down, hurt just after a hit, a blow (the first or the
 *  second, by turns) just after striking, the guard just after turning a blow, the walk on the move, else idle. */
export function heroFrame(sheet: PackSheetId, st: HeroState): Texture {
  const play = (pose: CreaturePose | 'attack', since: number, span: number): Texture => {
    const n = creaturePoseFrames(sheet, pose);
    const f = Math.min(n - 1, Math.floor((since / span) * n));
    return pose === 'attack' ? creatureFrame(sheet, 0, st.facing, f, true) : creatureFrame(sheet, 0, st.facing, f, false, pose);
  };
  if (st.down) return creatureFrame(sheet, 0, st.facing, 0, false, 'dead');
  if (st.sinceHit < HERO_HURT && creaturePoseFrames(sheet, 'hurt')) return play('hurt', st.sinceHit, HERO_HURT);
  if (st.sinceBlow < HERO_BLOW) {
    // (the blow's start, in whole seconds, picks which attack: steady while it plays, varying blow to blow)
    const second = creaturePoseFrames(sheet, 'attack2') > 0 && (Math.floor((st.now - st.sinceBlow * 100) / 1000) + st.ref) % 2 === 1;
    return play(second ? 'attack2' : 'attack', st.sinceBlow, HERO_BLOW);
  }
  if (st.sinceBlock < HERO_GUARD && creaturePoseFrames(sheet, 'defend')) return play('defend', st.sinceBlock, HERO_GUARD);
  if (st.moving) return creatureFrame(sheet, 0, st.facing, Math.floor(st.walked / 5));
  return creatureFrame(sheet, 0, st.facing, Math.floor(st.now / 180 + st.ref), false, 'idle');
}
